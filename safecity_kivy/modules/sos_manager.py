"""
SOS Emergency State Machine for Kivy

Manages the SOS flow:
IDLE -> COUNTDOWN -> BROADCAST

Provides countdown timer and broadcast data storage.
"""

from kivy.event import EventDispatcher
from kivy.properties import StringProperty, NumericProperty, DictProperty, BooleanProperty
from kivy.clock import Clock
import time
from typing import Optional, Callable
from dataclasses import dataclass


@dataclass
class BroadcastData:
    """Data to be broadcast during emergency."""
    location: str
    threat_info: str
    triggers: str
    frame_b64: str
    contact: str
    timestamp: str


class SOSManager(EventDispatcher):
    """
    SOS Emergency State Machine.
    
    States:
    - IDLE: Normal operation
    - COUNTDOWN: 3-second countdown before broadcast
    - BROADCAST: Emergency broadcast active
    """
    
    # State property
    state = StringProperty("IDLE")  # IDLE, COUNTDOWN, BROADCAST
    
    # Countdown
    countdown_remaining = NumericProperty(3)
    countdown_duration = NumericProperty(3)
    
    # Broadcast data
    broadcast_data = DictProperty({})
    
    # Flags
    is_sos_active = BooleanProperty(False)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._countdown_event: Optional[Clock] = None
        self._countdown_start_time: float = 0
        self._on_broadcast_callback: Optional[Callable] = None
        self._on_cancel_callback: Optional[Callable] = None
        
    def trigger_sos(self, location: str, threat_info: str, triggers: str, 
                    frame_b64: str, contact: str):
        """
        Trigger SOS countdown.
        
        Args:
            location: User's location
            threat_info: Description of the threat
            triggers: Active risk triggers
            frame_b64: Base64 encoded frame
            contact: Emergency contact number
        """
        if self.state != "IDLE":
            return
            
        # Store broadcast data
        self.broadcast_data = {
            "location": location,
            "threat_info": threat_info,
            "triggers": triggers,
            "frame_b64": frame_b64,
            "contact": contact,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # Start countdown
        self.state = "COUNTDOWN"
        self.is_sos_active = True
        self.countdown_remaining = self.countdown_duration
        self._countdown_start_time = time.time()
        
        # Schedule countdown updates
        self._countdown_event = Clock.schedule_interval(self._update_countdown, 0.1)
        
    def _update_countdown(self, dt):
        """Update countdown timer."""
        elapsed = time.time() - self._countdown_start_time
        remaining = max(0, self.countdown_duration - elapsed)
        self.countdown_remaining = int(remaining) + 1  # Show 1, 2, 3 (never 0)
        
        # Check if countdown complete
        if remaining <= 0:
            self._complete_countdown()
            
    def _complete_countdown(self):
        """Complete countdown and enter broadcast state."""
        if self._countdown_event:
            self._countdown_event.cancel()
            self._countdown_event = None
            
        self.state = "BROADCAST"
        
        # Call broadcast callback if set
        if self._on_broadcast_callback:
            self._on_broadcast_callback(self.broadcast_data)
            
    def send_now(self):
        """Immediately send broadcast (skip remaining countdown)."""
        if self.state == "COUNTDOWN":
            self._complete_countdown()
            
    def cancel_sos(self):
        """Cancel SOS and return to IDLE state."""
        if self._countdown_event:
            self._countdown_event.cancel()
            self._countdown_event = None
            
        self.state = "IDLE"
        self.is_sos_active = False
        self.broadcast_data = {}
        self.countdown_remaining = self.countdown_duration
        
        if self._on_cancel_callback:
            self._on_cancel_callback()
            
    def end_emergency(self):
        """End emergency broadcast and return to IDLE."""
        self.state = "IDLE"
        self.is_sos_active = False
        self.broadcast_data = {}
        self.countdown_remaining = self.countdown_duration
        
    def set_on_broadcast(self, callback: Callable):
        """Set callback for when broadcast starts."""
        self._on_broadcast_callback = callback
        
    def set_on_cancel(self, callback: Callable):
        """Set callback for when SOS is cancelled."""
        self._on_cancel_callback = callback
        
    def get_broadcast_data(self) -> dict:
        """Get current broadcast data."""
        return dict(self.broadcast_data)
