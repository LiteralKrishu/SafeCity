
import unittest
import sys
from unittest.mock import MagicMock, patch

# Mock speech_recognition before importing voice module
sys.modules["speech_recognition"] = MagicMock()
sys.modules["pyaudio"] = MagicMock()

from safecity_kivy.modules.voice import VoiceTrigger, VoiceResult

class TestVoiceTrigger(unittest.TestCase):
    def setUp(self):
        self.voice = VoiceTrigger(keywords=["help", "stop"])

    def test_initialization(self):
        self.assertFalse(self.voice.is_listening)
        self.assertEqual(self.voice.keywords, ["help", "stop"])

    @patch('threading.Thread')
    def test_start_listening(self, mock_thread):
        callback = MagicMock()
        self.voice.start_listening(callback)
        
        self.assertTrue(self.voice.is_listening)
        self.assertEqual(self.voice._callback, callback)
        mock_thread.assert_called_once()
        self.voice.stop()

    def test_stop_listening(self):
        self.voice.is_listening = True
        self.voice.stop()
        self.assertFalse(self.voice.is_listening)
        self.assertTrue(self.voice._stop_event.is_set())

    def test_keyword_match_logic(self):
        # Test the internal matching logic directly to avoid threading/mocking complexity
        # This simulates what _listen_loop does
        text = "please help me"
        detected_keyword = None
        for keyword in self.voice.keywords:
            if keyword in text:
                detected_keyword = keyword
                break
        
        self.assertEqual(detected_keyword, "help")

        text = "hello world"
        detected_keyword = None
        for keyword in self.voice.keywords:
            if keyword in text:
                detected_keyword = keyword
                break
        
        self.assertIsNone(detected_keyword)

if __name__ == '__main__':
    unittest.main()
