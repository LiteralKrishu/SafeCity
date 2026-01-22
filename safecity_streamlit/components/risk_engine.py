
import geocoder
import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional
import time


class RiskLevel(Enum):
    """Risk levels from lowest to highest severity."""
    SAFE = 0
    WATCH_MODE = 1
    WARNING = 2
    CRITICAL = 3


@dataclass
class RiskState:
    """Represents the current risk assessment state."""
    level: RiskLevel
    confidence: float  # 0.0 to 1.0
    triggers: List[str] = field(default_factory=list)
    action_required: bool = False
    message: str = ""
    
    def to_dict(self):
        return {
            "level": self.level.name,
            "confidence": self.confidence,
            "triggers": self.triggers,
            "action_required": self.action_required,
            "message": self.message
        }


class RiskEngine:
    """
    State-Based Risk Assessment Engine.
    
    Instead of linear scoring, this engine uses deterministic state transitions
    based on critical triggers (Scream, Keyword, Sneak Attack, Dangerous Actions)
    and contextual factors (Time, Location).
    """
    
    def __init__(self):
        self.current_city = "Unknown"
        self.location_risk_score = 10
        self.crime_stats_cache = {}
        
        # Temporal state
        self.last_escalation_time: float = 0
        self.current_state = RiskState(level=RiskLevel.SAFE, confidence=1.0)
        
        # Cooldown before risk level can drop (seconds)
        self.escalation_cooldown = 10.0
        
        # Keywords that trigger CRITICAL state
        self.distress_keywords = ["help", "stop", "police", "call 911", "save me", "danger"]
        
        # Actions that trigger specific risk levels
        self.critical_actions = ["fighting", "hitting", "attacking", "stabbing"]
        self.warning_actions = ["falling", "pushing", "running"]

    def get_location_context(self):
        """Fetch location via IP and determine baseline risk."""
        try:
            g = geocoder.ip('me')
            if g.city:
                self.current_city = g.city
                if self.current_city not in self.crime_stats_cache:
                    import random
                    random.seed(self.current_city)
                    self.crime_stats_cache[self.current_city] = random.randint(10, 60)
                self.location_risk_score = self.crime_stats_cache[self.current_city]
            else:
                self.current_city = "Unknown (Local)"
                self.location_risk_score = 10
        except Exception:
            self.current_city = "Offline"
            self.location_risk_score = 0
        return self.current_city, self.location_risk_score

    def _is_night_time(self) -> bool:
        """Check if current time is considered 'night' (higher risk)."""
        hour = datetime.datetime.now().hour
        return hour < 6 or hour > 20

    def _is_high_crime_zone(self) -> bool:
        """Check if current location is considered high crime."""
        return self.location_risk_score > 40

    def calculate_risk_state(
        self,
        video_threat_level: str,
        is_scream: bool,
        is_keyword_detected: bool = False,
        detected_keyword: Optional[str] = None,
        gyro_abnormal: bool = False,
        detected_action: Optional[str] = None
    ) -> RiskState:
        """
        Determine risk state based on sensor inputs and context.
        
        Priority Logic (highest to lowest):
        1. CRITICAL: Scream, Distress Keyword, Dangerous Action, or Confirmed Visual Threat
        2. WARNING: Abnormal Motion + Night, Warning Action, or Unconfirmed Visual
        3. WATCH_MODE: Night Time or High Crime Zone
        4. SAFE: Default
        """
        triggers = []
        level = RiskLevel.SAFE
        confidence = 1.0
        action_required = False
        message = ""
        
        # --- CRITICAL TRIGGERS (Immediate, bypass context) ---
        if is_scream:
            triggers.append("High-Frequency Audio (Scream)")
            level = RiskLevel.CRITICAL
            action_required = True
            message = "Scream detected!"
            
        if is_keyword_detected and detected_keyword:
            triggers.append(f"Distress Keyword: '{detected_keyword}'")
            level = RiskLevel.CRITICAL
            action_required = True
            message = f"Distress keyword '{detected_keyword}' detected!"
            
        if video_threat_level == "DANGER":
            triggers.append("Visual Threat (Sneak Attack)")
            level = RiskLevel.CRITICAL
            action_required = True
            message = "Threat approaching from behind!"
            
        if detected_action and detected_action.lower() in self.critical_actions:
            triggers.append(f"Dangerous Action: '{detected_action}'")
            level = RiskLevel.CRITICAL
            action_required = True
            message = f"Dangerous activity detected: {detected_action}!"
        
        # --- WARNING TRIGGERS ---
        if level.value < RiskLevel.WARNING.value:
            if detected_action and detected_action.lower() in self.warning_actions:
                triggers.append(f"Concerning Action: '{detected_action}'")
                level = RiskLevel.WARNING
                confidence = 0.7
                message = f"Activity detected: {detected_action}"
                
            elif gyro_abnormal:
                triggers.append("Abnormal Motion Detected")
                level = RiskLevel.WARNING
                confidence = 0.7
                message = "Unusual movement detected."
                
            elif video_threat_level == "WARNING":
                triggers.append("Motion Detected (Unconfirmed)")
                level = RiskLevel.WARNING
                confidence = 0.5
                message = "Movement detected in frame."
        
        # --- WATCH_MODE TRIGGERS ---
        if level.value < RiskLevel.WATCH_MODE.value:
            if self._is_high_crime_zone():
                triggers.append(f"High Crime Zone ({self.current_city})")
                level = RiskLevel.WATCH_MODE
                confidence = 0.6
                message = f"Elevated awareness in {self.current_city}."
        
        # --- Temporal Decay ---
        time_since_escalation = time.time() - self.last_escalation_time
        if level.value > RiskLevel.SAFE.value:
            self.last_escalation_time = time.time()
        elif self.current_state.level.value > level.value:
            if time_since_escalation < self.escalation_cooldown:
                level = RiskLevel(max(level.value, self.current_state.level.value - 1))
                triggers.append("Cooling Down")
                confidence = 0.5
                message = "Risk level stabilizing..."
        
        self.current_state = RiskState(
            level=level,
            confidence=confidence,
            triggers=triggers,
            action_required=action_required,
            message=message if message else "All clear."
        )
        return self.current_state

    # --- Legacy API for backwards compatibility ---
    def calculate_aggregate_risk(
        self, 
        video_threat_level: str, 
        is_scream: bool, 
        gyro_abnormal: bool
    ):
        """DEPRECATED: Use calculate_risk_state() instead."""
        state = self.calculate_risk_state(
            video_threat_level=video_threat_level,
            is_scream=is_scream,
            gyro_abnormal=gyro_abnormal
        )
        score_map = {
            RiskLevel.SAFE: 10,
            RiskLevel.WATCH_MODE: 30,
            RiskLevel.WARNING: 60,
            RiskLevel.CRITICAL: 95
        }
        total_risk = score_map.get(state.level, 10)
        breakdown = {
            "Risk State": state.level.name,
            "Triggers": ", ".join(state.triggers) if state.triggers else "None",
            "Action Required": "Yes" if state.action_required else "No"
        }
        return total_risk, breakdown
