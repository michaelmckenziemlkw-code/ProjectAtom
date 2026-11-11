"""Fixture tests for tempo maps, running status, velocity and pedal preservation."""
import struct
import os
import array
import wave
import math
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from render_midi import read_midi, render


class MidiTests(unittest.TestCase):
    def test_tempo_running_status_and_pedal(self):
        # PPQ 480; one beat at 120 BPM, then one beat at 60 BPM.
        track = bytes.fromhex('00ff510307a120 00903c40 00b0407f 8360803c00 00ff51030f4240 00903e20 83603e00 00b04000 00ff2f00')
        data = b'MThd' + struct.pack('>IHHH', 6, 0, 1, 480) + b'MTrk' + struct.pack('>I', len(track)) + track
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.mid'; path.write_bytes(data)
            events, info = read_midi(path)
        self.assertEqual(info['notes'], 2)
        self.assertEqual(info['pedalEvents'], 2)
        self.assertEqual(info['midiDuration'], 1.5)
        self.assertIn((0.5, 0x90, (62, 32)), events)
        self.assertIn((1.5, 0x90, (62, 0)), events)
        self.assertIn((1.5, 0xB0, (64, 0)), events)


@unittest.skipUnless(os.environ.get('PIANO_SOUNDFONT'), 'Set PIANO_SOUNDFONT for the audio-level damper test')
class DamperAudioTests(unittest.TestCase):
    def test_key_release_sustains_until_pedal_release_in_rendered_audio(self):
        levels = {}
        with tempfile.TemporaryDirectory() as directory:
            for pedal in (False, True):
                # Key released at 0.2 s; pedal released at 2.0 s.
                track = bytes.fromhex('00b040' + ('7f' if pedal else '00') + ' 00903c64 8140803c00 8d40b04000 00ff2f00')
                source = Path(directory) / f'{pedal}.mid'
                source.write_bytes(b'MThd' + struct.pack('>IHHH', 6, 0, 1, 480) + b'MTrk' + struct.pack('>I', len(track)) + track)
                output = Path(directory) / f'{pedal}.wav'
                with contextlib.redirect_stdout(io.StringIO()):
                    render(source, output, os.environ['PIANO_SOUNDFONT'])
                with wave.open(str(output)) as wav:
                    rate = wav.getframerate()
                    samples = array.array('h', wav.readframes(wav.getnframes()))
                def rms(start, end):
                    values = samples[round(start * rate) * 2:round(end * rate) * 2]
                    return math.sqrt(sum(v * v for v in values) / len(values)) / 32768
                levels[pedal] = (rms(1, 1.5), rms(3, 3.5))
        difference = 20 * math.log10(levels[True][0] / levels[False][0])
        damping = 20 * math.log10(levels[True][0] / max(1e-9, levels[True][1]))
        print(f'CC64: +{difference:.1f} dB after key release; -{damping:.1f} dB after pedal release')
        self.assertGreater(difference, 20)
        self.assertGreater(damping, 15)


if __name__ == '__main__': unittest.main()
