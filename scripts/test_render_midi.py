"""Fixture tests for tempo maps, running status, velocity and pedal preservation."""
import struct
import tempfile
import unittest
from pathlib import Path
from render_midi import read_midi


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


if __name__ == '__main__': unittest.main()
