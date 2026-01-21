
import kivy
kivy.require('2.3.0')
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.properties import StringProperty, NumericProperty, BooleanProperty
from kivy.clock import Clock
from kivy.lang import Builder

# Import Modules
from modules.camera_view import CameraView
from modules.sensors import SensorManager
from safecity_core.audio.monitor import AudioMonitor
from safecity_core.analysis.risk import RiskEngine

# Advanced Modules
from modules.cloud import CloudLogger
from modules.yamnet import AudioClassifier
from modules.voice import VoiceTrigger

import threading
import time

# Load KV file explicitely purely for clarity
Builder.load_file('safecity_kivy/safecity.kv')

class MainScreen(BoxLayout):
    status_text = StringProperty("SAFE")
    status_level = StringProperty("SAFE")
    audio_level = NumericProperty(0)
    gyro_status = StringProperty("Normal")
    voice_active = BooleanProperty(False)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.sensor_mgr = SensorManager()
        self.audio_mon = AudioMonitor()
        self.risk_engine = RiskEngine()
        
        # Advanced Init
        self.cloud_logger = CloudLogger()
        self.audio_ml = AudioClassifier()
        self.voice_trigger = VoiceTrigger()
        
        self.monitoring_event = None
        self.audio_thread = None
        self.stop_audio_flag = False

    def toggle_monitoring(self):
        app = App.get_running_app()
        cam = self.ids.camera_view
        
        if not app.is_monitoring:
            # START
            app.is_monitoring = True
            cam.start(0)
            self.audio_mon.start_stream()
            
            # Schedule Sensor Checks (Audio/Gyro) in background loop
            if not self.monitoring_event:
                self.monitoring_event = Clock.schedule_interval(self.check_sensors, 0.1)
            
            self.status_text = "MONITORING ACTIVE"
                
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
            
    def toggle_voice(self):
        if not self.voice_active:
            self.voice_active = True
            # Callback to handle voice commands
            def on_voice_command(text):
                print(f"Voice Command: {text}")
                if "help" in text.lower() or "emergency" in text.lower():
                    # Trigger alert on main thread
                    Clock.schedule_once(lambda dt: self.trigger_voice_alert(text))
            
            self.voice_trigger.start_listening(on_voice_command)
        else:
            self.voice_active = False
            self.voice_trigger.stop()

    def trigger_voice_alert(self, text):
        if not App.get_running_app().is_monitoring:
            self.toggle_monitoring()
        self.status_level = "DANGER"
        self.status_text = f"VOICE: {text.upper()}"
        self.cloud_logger.log_incident("VOICE", "HIGH", {"transcript": text})

    def check_sensors(self, dt):
        # 1. Audio Check (FFT + ML)
        is_scream_fft, vol = self.audio_mon.process_chunk()
        self.audio_level = vol
        
        # If we have an audio buffer, we could pass it to YAMNet here
        # For this demo, we simulate the ML check if FFT is high
        ml_class, ml_conf = "Unknown", 0.0
        if is_scream_fft:
             # In real impl, pass the buffer
             ml_class, ml_conf = self.audio_ml.classify_audio(None)
        
        # 2. Gyro/Sensor Check
        ax, ay, az = self.sensor_mgr.get_acceleration()
        is_impact, gyro_msg = self.sensor_mgr.analyze_impact(ax, ay, az)
        self.gyro_status = "Impact!" if is_impact else "Normal"
        
        # 3. Video Threat (from Camera Widget)
        video_threat = self.ids.camera_view.threat_level
        video_msg = self.ids.camera_view.message
        
        # 4. Context Fusion
        total_risk, breakdown = self.risk_engine.calculate_aggregate_risk(
            video_threat_level=video_threat,
            is_scream=is_scream_fft,
            gyro_abnormal=is_impact
        )
        
        # 5. Update UI & Log to Cloud
        detected_threat = False
        incident_type = "NONE"
        
        if total_risk > 80:
             self.status_level = "DANGER"
             self.status_text = "DANGER!"
             detected_threat = True
             incident_type = "HIGH_COMPOSITE_RISK"
             
        elif video_threat == "DANGER":
             self.status_level = "DANGER"
             self.status_text = video_msg
             detected_threat = True
             incident_type = "VISUAL_THREAT"

        elif is_scream_fft:
             self.status_level = "DANGER"
             self.status_text = "SCREAM DETECTED!"
             detected_threat = True
             incident_type = "AUDIO_SCREAM"
             
        elif is_impact:
             self.status_level = "DANGER"
             self.status_text = gyro_msg
             detected_threat = True
             incident_type = "IMPACT_FALL"
             
        elif video_threat == "WARNING":
            self.status_level = "WARNING"
            self.status_text = "WARNING"
        else:
            self.status_level = "SAFE"
            self.status_text = f"Monitored ({self.risk_engine.current_city})"

        # 6. Cloud Logging (Throttle logic needed in prod, here we just log on transition)
        # For simple demo, we log every time we confirm DANGER if it wasn't DANGER before
        # (This implies we need previous state, skipping for brevity but logically here)
        if detected_threat:
             self.cloud_logger.log_incident(incident_type, "HIGH", breakdown)

    def simulate_impact(self):
        # Temporary mock trigger for the button
        self.gyro_status = "Simulated Impact"
        self.status_level = "DANGER"
        self.status_text = "IMPACT DETECTED (SIM)"
        # Log it
        self.cloud_logger.log_incident("SIMULATION", "TEST", {"details": "Manual Trigger"})
        # Reset after 2 seconds
        Clock.schedule_once(lambda dt: self.reset_sim(), 2)
        
    def reset_sim(self):
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

if __name__ == '__main__':
    SafeCityApp().run()
