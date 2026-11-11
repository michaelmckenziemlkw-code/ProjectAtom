"""Render SMF 0/1 MIDI to piano WAV using system libfluidsynth (no Python dependencies).
Usage: python3 scripts/render_midi.py input.mid output.wav /path/to/piano.sf2
Tempo maps, running status, velocity, note-offs and controllers (including pedal) are preserved.
The FluidR3 piano uses a longer string decay; pedal release still damps the notes.
"""
import ctypes as C
import ctypes.util
import json
import hashlib
from pathlib import Path
import struct
import sys
import wave


def read_midi(path):
    data = Path(path).read_bytes()
    if data[:4] != b'MThd':
        raise ValueError('Not a Standard MIDI File')
    size = int.from_bytes(data[4:8], 'big')
    fmt, tracks, division = struct.unpack('>HHH', data[8:14])
    if fmt > 1 or division & 0x8000:
        raise ValueError('Only synchronous PPQ MIDI format 0/1 is supported')
    events = []
    pos = 8 + size
    for track in range(tracks):
        if data[pos:pos+4] != b'MTrk':
            raise ValueError('Missing track header')
        end = pos + 8 + int.from_bytes(data[pos+4:pos+8], 'big')
        pos += 8
        ticks = 0
        running = None
        def vlq():
            nonlocal pos
            value = 0
            for _ in range(4):
                byte = data[pos]; pos += 1
                value = (value << 7) | (byte & 127)
                if not byte & 128:
                    return value
            raise ValueError('Invalid variable-length integer')
        while pos < end:
            ticks += vlq()
            status = data[pos]
            if status & 128:
                pos += 1
                if status < 0xF0:
                    running = status
            elif running is not None:
                status = running
            else:
                raise ValueError('Missing running status')
            if status == 0xFF:
                meta = data[pos]; pos += 1
                length = vlq()
                payload = data[pos:pos+length]; pos += length
                if meta == 0x51:
                    events.append((ticks, track, 'tempo', int.from_bytes(payload, 'big')))
                elif meta == 0x2F:
                    events.append((ticks, track, 'end', 0))
            elif status in (0xF0, 0xF7):
                length = vlq(); pos += length
                running = None
            elif status < 0xF0:
                length = 1 if status >> 4 in (0xC, 0xD) else 2
                payload = tuple(data[pos:pos+length]); pos += length
                events.append((ticks, track, status, payload))
            else:
                raise ValueError('Unsupported system event')
        pos = end
    tempo = 500000
    last_tick = 0
    seconds = 0
    timed = []
    for ticks, track, status, payload in sorted(events, key=lambda e: (e[0], e[1])):
        seconds += (ticks - last_tick) * tempo / (division * 1000000)
        last_tick = ticks
        if status == 'tempo':
            tempo = payload
        timed.append((seconds, status, payload))
    return timed, dict(format=fmt, tracks=tracks, ppq=division,
                      midiDuration=seconds,
                      notes=sum(isinstance(s, int) and s >> 4 == 9 and p[1] > 0 for _, s, p in timed),
                      pedalEvents=sum(isinstance(s, int) and s >> 4 == 11 and p[0] == 64 for _, s, p in timed))


def render(source, output, soundfont):
    events, info = read_midi(source)
    lib = C.CDLL(ctypes.util.find_library('fluidsynth'))
    def fn(name, result, *args):
        f = getattr(lib, name); f.restype = result; f.argtypes = list(args); return f
    ptr, integer, string = C.c_void_p, C.c_int, C.c_char_p
    settings = fn('new_fluid_settings', ptr)()
    fn('fluid_settings_setnum', integer, ptr, string, C.c_double)(settings, b'synth.sample-rate', 44100)
    fn('fluid_settings_setnum', integer, ptr, string, C.c_double)(settings, b'synth.gain', 0.55)
    synth = fn('new_fluid_synth', ptr, ptr)(settings)
    if fn('fluid_synth_sfload', integer, ptr, string, integer)(synth, str(soundfont).encode(), 1) < 0:
        raise ValueError('Cannot load SoundFont')
    note_on = fn('fluid_synth_noteon', integer, ptr, integer, integer, integer)
    note_off = fn('fluid_synth_noteoff', integer, ptr, integer, integer)
    cc = fn('fluid_synth_cc', integer, ptr, integer, integer, integer)
    pitch = fn('fluid_synth_pitch_bend', integer, ptr, integer, integer)
    write = fn('fluid_synth_write_s16', integer, ptr, integer, ptr, integer, integer, ptr, integer, integer)
    program = fn('fluid_synth_program_change', integer, ptr, integer, integer)
    set_gen = fn('fluid_synth_set_gen', integer, ptr, integer, integer, C.c_float)
    for channel in range(16):
        program(synth, channel, 0)
        # Add 900 timecents (~1.68x) to string decay, not release or reverb.
        # CC64 therefore keeps the string ringing; pedal-up still engages the damper.
        set_gen(synth, channel, 36, 900.0)
    duration = info['midiDuration'] + 3
    total = round(duration * 44100)
    buffer = (C.c_int16 * (4096 * 2))()
    peak = 0
    with wave.open(str(output), 'wb') as wav:
        wav.setparams((2, 2, 44100, 0, 'NONE', 'not compressed'))
        cursor = 0
        def until(frame):
            nonlocal cursor, peak
            while cursor < frame:
                count = min(4096, frame - cursor)
                write(synth, count, buffer, 0, 2, buffer, 1, 2)
                peak = max(peak, max(abs(v) for v in buffer[:count*2]))
                wav.writeframesraw(bytes(buffer)[:count * 4])
                cursor += count
        for time, status, payload in events:
            until(round(time * 44100))
            if not isinstance(status, int):
                continue
            command, channel = status >> 4, status & 15
            if command == 9 and payload[1]: note_on(synth, channel, *payload)
            elif command in (8, 9): note_off(synth, channel, payload[0])
            elif command == 11: cc(synth, channel, *payload)
            elif command == 14: pitch(synth, channel, payload[0] | payload[1] << 7)
        # Release a pedal left down at the end before the instrument's decay tail.
        for channel in range(16): cc(synth, channel, 64, 0)
        until(total)
    fn('delete_fluid_synth', None, ptr)(synth)
    fn('delete_fluid_settings', None, ptr)(settings)
    info.update(audioDuration=duration, peak=peak / 32768, instrument='FluidR3 GM Yamaha Grand Piano', decayTimecents=900,
                sourceSha256=hashlib.sha256(Path(source).read_bytes()).hexdigest())
    print(json.dumps(info, indent=2))


if __name__ == '__main__':
    if len(sys.argv) == 2:
        print(json.dumps(read_midi(sys.argv[1])[1], indent=2))
    else:
        render(*sys.argv[1:])
