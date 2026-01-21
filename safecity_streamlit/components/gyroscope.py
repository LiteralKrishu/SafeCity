
import numpy as np

class GyroscopeMonitor:
    def __init__(self):
        self.IMPACT_THRESHOLD_G = 3.0 # > 3G is usually an impact
        self.FREE_FALL_THRESHOLD_G = 0.2 # < 0.2G implies free fall
        
    def process_data(self, x: float, y: float, z: float):
        """
        Process accelerometer data (in Gs).
        Returns: is_abnormal (bool), message (str)
        """
        # Calculate magnitude of acceleration vector
        magnitude = np.sqrt(x**2 + y**2 + z**2)
        
        if magnitude > self.IMPACT_THRESHOLD_G:
            return True, f"HIGH IMPACT DETECTED! ({magnitude:.1f}G)"
            
        if magnitude < self.FREE_FALL_THRESHOLD_G:
             return True, "FREE FALL DETECTED!"
             
        return False, "Normal"
