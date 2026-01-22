
import geocoder
import datetime
import random # To simulate crime stats for demo without expensive API

class RiskEngine:
    def __init__(self):
        self.current_city = "Unknown"
        self.location_risk_score = 10
        self.last_fetch = 0
        self.crime_stats_cache = {}

    def get_location_context(self):
        """
        Fetch location via IP and determine baseline risk.
        Cached per session slightly to avoid spamming.
        """
        try:
            g = geocoder.ip('me')
            if g.city:
                self.current_city = g.city
                # Simulate a crime score lookup
                if self.current_city not in self.crime_stats_cache:
                    # Deterministic hash for demo consistency vs random
                    random.seed(self.current_city)
                    self.crime_stats_cache[self.current_city] = random.randint(10, 60)
                
                self.location_risk_score = self.crime_stats_cache[self.current_city]
            else:
                self.current_city = "Unknown (Local)"
                self.location_risk_score = 10
        except:
             self.current_city = "Offline"
             self.location_risk_score = 0
             
        return self.current_city, self.location_risk_score

    def calculate_aggregate_risk(self, 
                                 video_threat_level: str, 
                                 is_scream: bool, 
                                 gyro_abnormal: bool):
        """
        Fuse all sensors into a 0-100 score + breakdown.
        """
        # 1. Base Context (Location + Time) - TIME EXCLUDED FROM RISK ASSESSMENT
        time_factor = 0
        
        # 2. Dynamic Sensors
        # Load Config
        from safecity_core.config import config
        weights = config.risk.get("weights", {})
        
        video_score = 0
        if video_threat_level == "DANGER": video_score = weights.get("video_danger", 50)
        elif video_threat_level == "WARNING": video_score = weights.get("video_warning", 25)
        
        audio_score = weights.get("audio_scream", 40) if is_scream else 0
        motion_score = weights.get("motion_impact", 30) if gyro_abnormal else 0
        time_factor_val = weights.get("time_factor", 20)
        
        # time_factor weights are ignored
        
        base_score = self.location_risk_score + time_factor
        
        # Aggregate
        total_risk = base_score + video_score + audio_score + motion_score
        total_risk = min(100, total_risk)
        
        # Breakdown for UI
        breakdown = {
            "Location Context": self.location_risk_score,
            "Visual Threat": video_score,
            "Audio Analysis": audio_score,
            "Motion/Impact": motion_score
        }
        
        return total_risk, breakdown
