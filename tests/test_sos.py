
import unittest
import time
from safecity_kivy.modules.sos_manager import SOSManager

class TestSOSManager(unittest.TestCase):
    def setUp(self):
        self.sos = SOSManager()
        self.sos.countdown_duration = 1  # Speed up tests

    def test_initial_state(self):
        self.assertEqual(self.sos.state, "IDLE")
        self.assertFalse(self.sos.is_sos_active)
        self.assertEqual(self.sos.broadcast_data, {})

    def test_trigger_sos(self):
        self.sos.trigger_sos(
            location="Test City",
            threat_info="Test Threat",
            triggers="Test Trigger",
            frame_b64="base64data",
            contact="123"
        )
        self.assertEqual(self.sos.state, "COUNTDOWN")
        self.assertTrue(self.sos.is_sos_active)
        
        # Verify data storage
        self.assertEqual(self.sos.broadcast_data["location"], "Test City")
        self.assertEqual(self.sos.broadcast_data["threat_info"], "Test Threat")

    def test_cancel_sos(self):
        self.sos.trigger_sos("Loc", "Threat", "Trig", "img", "123")
        self.sos.cancel_sos()
        self.assertEqual(self.sos.state, "IDLE")
        self.assertFalse(self.sos.is_sos_active)
        self.assertEqual(self.sos.broadcast_data, {})

    def test_send_now(self):
        self.sos.trigger_sos("Loc", "Threat", "Trig", "img", "123")
        self.sos.send_now()
        self.assertEqual(self.sos.state, "BROADCAST")

    def test_countdown_completion(self):
        # Mocking time/clock is hard with Kivy's Clock, 
        # but we can test the internal logic methods directly if we weren't relying on the actual Clock
        # For this unit test, we'll manually invoke the completion method which Clock would call
        self.sos.trigger_sos("Loc", "Threat", "Trig", "img", "123")
        self.sos._complete_countdown()
        self.assertEqual(self.sos.state, "BROADCAST")

if __name__ == '__main__':
    unittest.main()
