
import kivy
kivy.require('2.3.0')
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.properties import (
    StringProperty, NumericProperty, BooleanProperty, 
    ListProperty, ObjectProperty
)
from kivy.clock import Clock
from kivy.lang import Builder

# Import Modules
from safecity_kivy.modules.camera_view import CameraView
from safecity_kivy.modules.sensors import SensorManager
from safecity_core.audio.monitor import AudioMonitor
from safecity_kivy.modules.sos_manager import SOSManager

# Advanced Modules
from safecity_kivy.modules.cloud import CloudLogger
from safecity_kivy.modules.yamnet import AudioClassifier
from safecity_kivy.modules.voice import VoiceTrigger, VoiceResult

# State-based Risk Engine (from Streamlit)
from safecity_streamlit.components.risk_engine import RiskEngine, RiskLevel, RiskState

import threading
import time
from kivy.core.text import LabelBase

# Register Material Design Icons
LabelBase.register(
    name='MDI',
    fn_regular='safecity_kivy/resources/materialdesignicons-webfont.ttf'
)

class Icons:
    """Material Design Icons codepoints mapping."""
    SHIELD = chr(0xF0497)
    SOS = chr(0xF0B05)
    ALERT = chr(0xF0026)
    MIC = chr(0xF036C)
    MIC_OFF = chr(0xF0370)
    VIDEO = chr(0xF0100)
    LOCATION = chr(0xF034C)
    PULSE = chr(0xF055E)
    CHART = chr(0xF013D)
    CAMERA = chr(0xF0100)
    START = chr(0xF040A)
    STOP = chr(0xF04DB)
    IMPACT = chr(0xF02F1)
    CHECK = chr(0xF012C)
    MAP = chr(0xF034D)

# Load KV file
Builder.load_file('safecity_kivy/safecity.kv')


class MainScreen(BoxLayout):
    # Status properties
    status_text = StringProperty("SAFE")
    status_level = StringProperty("SAFE")
    risk_level = StringProperty("SAFE")
    
    # Sensor properties
    audio_level = NumericProperty(0)
    gyro_status = StringProperty("Normal")
    voice_active = BooleanProperty(False)
    
    # Risk Engine properties
    active_triggers = StringProperty("None")
    action_required = BooleanProperty(False)
    
    # SOS Manager
    sos_manager = ObjectProperty(None)
    
    # Metrics properties (Streamlit inspired)
    visual_threat_val = NumericProperty(0)
    audio_analysis_val = NumericProperty(0)
    audio_analysis_msg = StringProperty("Low")
    motion_impact_val = NumericProperty(0)
    context_risk_val = NumericProperty(0)
    system_confidence = NumericProperty(0)
    
    # Animation properties
    pulse_opacity = NumericProperty(1.0)
    _pulse_direction = NumericProperty(-1)
    
    # Broadcast display properties
    broadcast_location = StringProperty("")
    broadcast_threat = StringProperty("")
    broadcast_contact = StringProperty("+1 (555) 123-4567")
    
    # Icons mapping
    icons = ObjectProperty(None)
    
    # Status colors
    status_color = ListProperty([0, 1, 0, 1])  # Green default
    status_bg_color = ListProperty([0, 0.3, 0, 0.5])
    
    def __init__(self, **kwargs):
        # SOS Manager MUST be initialized before super().__init__ 
        # because the KV file references root.sos_manager during application.
        self.sos_manager = SOSManager()
        self.sos_manager.set_on_broadcast(self._on_broadcast_started)
        self.sos_manager.set_on_cancel(self._on_sos_cancelled)
        
        # Initialize icons before super().__init__ so they are available in KV
        self.icons = Icons
        
        super().__init__(**kwargs)
        self.sensor_mgr = SensorManager()
        self.audio_mon = AudioMonitor()
        self.risk_engine = RiskEngine()
        
        # Advanced Init
        self.cloud_logger = CloudLogger()
        self.audio_ml = AudioClassifier()
        self.voice_trigger = VoiceTrigger()
        
        self.monitoring_event = None
        
        # Current risk state
        self.current_risk_state: RiskState = RiskState(
            level=RiskLevel.SAFE, 
            confidence=1.0, 
            message="System Ready"
        )
        
        # Keyword detection state
        self.last_keyword: str = ""
        self.keyword_detected: bool = False
        
        # Get location context
        self.city, self.loc_risk = self.risk_engine.get_location_context()
        
        # Start animation Clock
        Clock.schedule_interval(self._animate_pulse, 1/30.0)

    def _animate_pulse(self, dt):
        """Handle UI pulsing animation for alerts."""
        if self.status_level == "SAFE":
            if self.pulse_opacity < 1.0:
                self.pulse_opacity = min(1.0, self.pulse_opacity + 0.05)
            return

        # Pulse logic
        step = 0.02 if self.status_level == "CRITICAL" else 0.01
        self.pulse_opacity += self._pulse_direction * step
        
        if self.pulse_opacity <= 0.6:
            self.pulse_opacity = 0.6
            self._pulse_direction = 1
        elif self.pulse_opacity >= 1.0:
            self.pulse_opacity = 1.0
            self._pulse_direction = -1

    def toggle_monitoring(self):
        app = App.get_running_app()
        cam = self.ids.camera_view
        
        if not app.is_monitoring:
            # START
            app.is_monitoring = True
            cam.start(0)
            self.audio_mon.start_stream()
            
            # Schedule Sensor Checks
            if not self.monitoring_event:
                self.monitoring_event = Clock.schedule_interval(self.check_sensors, 0.1)
            
            self.status_text = "MONITORING"
            self._update_status_color(RiskLevel.SAFE)
                
        else:
            # STOP
            app.is_monitoring = False
            cam.stop()
            self.audio_mon.stop_stream()
            if self.monitoring_event:
                self.monitoring_event.cancel()
                self.monitoring_event = None
            self.status_text = "PAUSED"
            self.status_level = "SAFE"
            self._update_status_color(RiskLevel.SAFE)
            
    def toggle_voice(self):
        if not self.voice_active:
            self.voice_active = True
            self.voice_trigger.start_listening(self._on_voice_detected)
        else:
            self.voice_active = False
            self.voice_trigger.stop()

    def _on_voice_detected(self, result: VoiceResult):
        """Callback when voice keyword is detected."""
        if result.is_keyword_detected:
            self.keyword_detected = True
            self.last_keyword = result.detected_keyword or ""
            
            # Schedule UI update on main thread
            Clock.schedule_once(lambda dt: self._trigger_voice_alert(result))

    def _trigger_voice_alert(self, result: VoiceResult):
        """Handle voice alert on main thread."""
        if not App.get_running_app().is_monitoring:
            self.toggle_monitoring()
            
        # Log to cloud
        self.cloud_logger.log_incident("VOICE", "HIGH", {
            "keyword": result.detected_keyword,
            "full_text": result.full_text
        })

    def check_sensors(self, dt):
        """Main sensor fusion loop."""
        cam = self.ids.camera_view
        
        # 1. Audio Check (FFT + get keywords from audio monitor)
        audio_result = self.audio_mon.process_chunk_full()
        self.audio_level = float(audio_result.volume)
        
        # Check voice trigger results too
        voice_keyword = self.last_keyword if self.keyword_detected else None
        self.keyword_detected = False
        self.last_keyword = ""
        
        # Combine audio keyword detection sources
        is_keyword = audio_result.is_keyword_detected or (voice_keyword is not None)
        detected_keyword = audio_result.detected_keyword or voice_keyword
        
        # 2. Gyro/Sensor Check
        ax, ay, az = self.sensor_mgr.get_acceleration()
        is_impact, gyro_msg = self.sensor_mgr.analyze_impact(ax, ay, az)
        self.gyro_status = "Impact!" if is_impact else "Normal"
        
        # 3. Video Threat (from Camera Widget)
        video_threat = cam.threat_level
        detected_action = cam.detected_action
        
        # 4. Context Fusion with State-Based Risk Engine
        risk_state = self.risk_engine.calculate_risk_state(
            video_threat_level=video_threat,
            is_scream=audio_result.is_scream,
            is_keyword_detected=is_keyword,
            detected_keyword=detected_keyword,
            gyro_abnormal=is_impact,
            detected_action=detected_action
        )
        
        self.current_risk_state = risk_state
        
        # 5. Update UI
        self._update_ui_from_risk_state(risk_state)
        
        # 6. Check for SOS Trigger
        if risk_state.level == RiskLevel.CRITICAL and self.sos_manager.state == "IDLE":
            self._trigger_sos()
        
        # 7. Cloud Logging (if action required)
        if risk_state.action_required:
            self.cloud_logger.log_incident(
                risk_state.level.name,
                "HIGH" if risk_state.level == RiskLevel.CRITICAL else "MEDIUM",
                {
                    "triggers": risk_state.triggers,
                    "message": risk_state.message,
                    "action": detected_action
                }
            )

    def _update_ui_from_risk_state(self, state: RiskState):
        """Update UI based on risk state."""
        self.status_level = state.level.name
        self.status_text = state.message if state.message else state.level.name
        self.risk_level = state.level.name
        self.active_triggers = ", ".join(state.triggers) if state.triggers else "Stable"
        self.action_required = state.action_required
        self.system_confidence = state.confidence
        self._update_status_color(state.level)
        
        # Update metrics values
        cam = self.ids.camera_view
        
        # 1. Visual Threat
        self.visual_threat_val = 100 if cam.threat_level == "DANGER" else (50 if cam.threat_level == "WARNING" else 0)
        
        # 2. Audio Analysis
        audio_res = self.audio_mon.process_chunk_full() # This might be redundant if called in check_sensors
        # but check_sensors already updates self.audio_level
        self.audio_analysis_val = 100 if (self.audio_level > 500 or state.level != RiskLevel.SAFE) else 0
        self.audio_analysis_msg = "Scream/Keyword" if self.audio_analysis_val == 100 else "Noise"
        
        # 3. Motion Impact
        self.motion_impact_val = 100 if self.gyro_status == "Impact!" else 0
        
        # 4. Context Risk
        self.context_risk_val = int(self.loc_risk + (20 if self.risk_engine._is_night_time() else 0))

    def _update_status_color(self, level: RiskLevel):
        """Update status badge colors based on risk level."""
        color_map = {
            RiskLevel.SAFE: ([0, 1, 0, 1], [0, 0.3, 0, 0.5]),
            RiskLevel.WATCH_MODE: ([0, 0.7, 0.9, 1], [0, 0.2, 0.3, 0.5]),
            RiskLevel.WARNING: ([1, 0.65, 0.15, 1], [0.3, 0.2, 0, 0.5]),
            RiskLevel.CRITICAL: ([1, 0, 0, 1], [0.3, 0, 0, 0.5]),
        }
        self.status_color, self.status_bg_color = color_map.get(
            level, ([0, 1, 0, 1], [0, 0.3, 0, 0.5])
        )

    def _trigger_sos(self):
        """Trigger SOS countdown."""
        cam = self.ids.camera_view
        
        self.sos_manager.trigger_sos(
            location=self.city,
            threat_info=self.current_risk_state.message,
            triggers=", ".join(self.current_risk_state.triggers),
            frame_b64=cam.get_last_frame_b64(),
            contact=self.broadcast_contact
        )

    def _on_broadcast_started(self, data: dict):
        """Callback when broadcast starts."""
        self.broadcast_location = data.get("location", "Unknown")
        self.broadcast_threat = data.get("threat_info", "Emergency")
        self.broadcast_contact = data.get("contact", "+1 (555) 123-4567")
        
        # Log to cloud
        self.cloud_logger.log_incident("SOS_BROADCAST", "CRITICAL", data)

    def _on_sos_cancelled(self):
        """Callback when SOS is cancelled."""
        self.status_text = "SOS Cancelled"
        self.status_level = "SAFE"
        self._update_status_color(RiskLevel.SAFE)

    def cancel_sos(self):
        """Cancel SOS from UI."""
        self.sos_manager.cancel_sos()

    def send_sos_now(self):
        """Send SOS immediately from UI."""
        self.sos_manager.send_now()

    def end_emergency(self):
        """End emergency broadcast from UI."""
        self.sos_manager.end_emergency()
        self.broadcast_location = ""
        self.broadcast_threat = ""
        self.status_text = "Emergency Resolved"
        self._update_status_color(RiskLevel.SAFE)

    def manual_sos(self):
        """Manually trigger SOS from button."""
        if self.sos_manager.state == "IDLE":
            cam = self.ids.camera_view
            self.sos_manager.trigger_sos(
                location=self.city,
                threat_info="Manual SOS Triggered",
                triggers="User Button Press",
                frame_b64=cam.get_last_frame_b64() if cam else "",
                contact=self.broadcast_contact
            )

    def simulate_impact(self):
        """Simulate gyro impact for testing."""
        self.gyro_status = "Simulated Impact"
        self.status_level = "DANGER"
        self.status_text = "IMPACT DETECTED (SIM)"
        self._update_status_color(RiskLevel.CRITICAL)
        
        # Trigger SOS
        if self.sos_manager.state == "IDLE":
            self._trigger_sos()
        
        self.cloud_logger.log_incident("SIMULATION", "TEST", {"details": "Manual Trigger"})
        Clock.schedule_once(lambda dt: self._reset_sim(), 2)
        
    def _reset_sim(self):
        self.gyro_status = "Normal"


class SafeCityApp(App):
    is_monitoring = BooleanProperty(False)

    def build(self):
        return MainScreen()

    def on_stop(self):
        # Cleanup
        if self.root:
            if self.is_monitoring:
                self.root.toggle_monitoring()
            if self.root.voice_active:
                self.root.toggle_voice()
            if self.root.sos_manager.is_sos_active:
                self.root.sos_manager.cancel_sos()


if __name__ == '__main__':
    SafeCityApp().run()
