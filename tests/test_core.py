
import sys
import unittest
from unittest.mock import MagicMock

# Mock libs
sys.modules["cv2"] = MagicMock()
sys.modules["mediapipe"] = MagicMock()
sys.modules["pyaudio"] = MagicMock()

class TestSafeCityCore(unittest.TestCase):
    def test_imports(self):
        try:
            from safecity_core.vision.detector import ThreatDetector
            from safecity_core.audio.monitor import AudioMonitor
            from safecity_core.analysis.risk import RiskEngine
            from safecity_core.ai.verification import verify_visual_threat
            print("Imports successful")
        except ImportError as e:
            self.fail(f"Import failed: {e}")

if __name__ == '__main__':
    unittest.main()
