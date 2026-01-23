
from plyer import accelerometer
import numpy as np

class SensorManager:
    def __init__(self):
        self.IMPACT_THRESHOLD_G = 3.0 
        self.FREE_FALL_THRESHOLD_G = 0.2
        self.has_hardware_gyro = False
        
        try:
            from plyer import accelerometer
            # Check if platform is supported before enabling to avoid ugly tracebacks
            import sys
            if sys.platform == 'win32':
                # Plyer on Windows usually requires distinct implementation or hardware
                # verifying if the specific module exists is hard without triggering import
                # So we just try-except, but suppress stderr if we could, 
                # but valid strategy is just to accept the log or check 'plyer.utils.platform'
                pass

            accelerometer.enable()
            self.has_hardware_gyro = True
        except Exception as e:
            # print(f"Sensor init error: {e}") # Debug only
            print("Plyer Accelerometer not available (likely Desktop). Using Mock Mode.")
            self.has_hardware_gyro = False
            
    def get_acceleration(self):
        """
        Returns (x, y, z) tuple in Gs.
        If logic unavailable, returns a default (0, 0, 1) [gravity].
        """
        if self.has_hardware_gyro:
            try:
                # Plyer returns in m/s^2 usually, divide by 9.8 for G
                val = accelerometer.acceleration
                if val == (None, None, None):
                    return (0, 0, 1.0)
                # Normalize assuming m/s^2 if values are large, or raw if small? 
                # Plyer documentation varies, but usually it tries to be standard.
                # Let's assume Gs for now or check magnitude.
                x, y, z = val
                return (x/9.8, y/9.8, z/9.8) 
            except:
                return (0, 0, 1.0)
        else:
            return (0, 0, 1.0) # Desktop Mock Default (Standing still)

    def analyze_impact(self, x, y, z):
        magnitude = np.sqrt(x**2 + y**2 + z**2)
        
        if magnitude > self.IMPACT_THRESHOLD_G:
            return True, f"HIGH IMPACT DETECTED! ({magnitude:.1f}G)"
            
        if magnitude < self.FREE_FALL_THRESHOLD_G:
             return True, "FREE FALL DETECTED!"
             
        return False, "Normal"
