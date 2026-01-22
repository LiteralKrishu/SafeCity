"""
Camera View Widget with Threat Detection and Action Recognition

Provides real-time video feed with:
- Sneak attack detection (MediaPipe pose)
- Action recognition (ONNX/motion heuristics)
"""

from kivy.uix.image import Image
from kivy.graphics.texture import Texture
from kivy.clock import Clock, mainthread
from kivy.properties import ObjectProperty, StringProperty, BooleanProperty, NumericProperty
import cv2
import numpy as np
import threading
import time
from safecity_core.vision.detector import ThreatDetector
from safecity_core.vision.action_recognizer import get_action_recognizer


class CameraView(Image):
    """
    Camera widget with integrated threat and action detection.
    """
    detector = ObjectProperty(None)
    threat_level = StringProperty("SAFE")
    message = StringProperty("")
    
    # New: Action recognition properties
    detected_action = StringProperty("")
    action_confidence = NumericProperty(0.0)
    is_action_dangerous = BooleanProperty(False)
    
    def __init__(self, **kwargs):
        super(CameraView, self).__init__(**kwargs)
        self.capture = None
        self.detector = ThreatDetector()
        self.action_recognizer = get_action_recognizer()
        self.fps = 30
        self.is_active = False
        self.thread = None
        self.stop_event = threading.Event()
        
        # Store last frame for SOS broadcast
        self.last_frame = None
        self.last_frame_b64 = ""

    def start(self, camera_index=0):
        """Start the camera feed and processing."""
        if not self.is_active:
            self.capture = cv2.VideoCapture(camera_index)
            self.is_active = True
            self.stop_event.clear()
            self.thread = threading.Thread(target=self.process_video_loop)
            self.thread.daemon = True
            self.thread.start()

    def stop(self):
        """Stop the camera feed."""
        self.is_active = False
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None
        if self.capture:
            self.capture.release()
            self.capture = None

    def process_video_loop(self):
        """Background video processing loop."""
        while not self.stop_event.is_set() and self.capture and self.capture.isOpened():
            ret, frame = self.capture.read()
            if ret:
                # 1. Threat Detection (Pose + Sneak Attack)
                result = self.detector.process_frame(frame)
                
                # 2. Action Recognition
                action_result = self.action_recognizer.process_frame(result.annotated_frame)
                
                action_name = ""
                action_conf = 0.0
                action_dangerous = False
                
                if action_result:
                    action_name = action_result.action
                    action_conf = action_result.confidence
                    action_dangerous = action_result.is_dangerous
                
                # 3. Store frame for potential SOS
                self.last_frame = result.annotated_frame.copy()
                
                # Encode to base64 for broadcast panel
                try:
                    _, encoded = cv2.imencode('.jpg', result.annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    import base64
                    self.last_frame_b64 = base64.b64encode(encoded).decode('utf-8')
                except Exception:
                    pass
                
                # 4. Update UI on Main Thread
                self.update_ui(
                    result.annotated_frame,
                    result.threat_level,
                    result.message,
                    action_name,
                    action_conf,
                    action_dangerous
                )
            
            # Limit FPS
            time.sleep(1.0 / self.fps)

    @mainthread
    def update_ui(self, frame, threat_level, message, action, action_conf, action_dangerous):
        """Update UI properties on main thread."""
        # Update threat properties
        self.threat_level = threat_level
        self.message = message
        
        # Update action properties
        self.detected_action = action
        self.action_confidence = action_conf
        self.is_action_dangerous = action_dangerous
        
        # Escalate threat level if dangerous action detected
        if action_dangerous and self.threat_level != "DANGER":
            self.threat_level = "DANGER"
            self.message = f"DANGEROUS ACTION: {action.upper()}"
        
        # Update texture
        buf1 = cv2.flip(frame, 0)
        buf = buf1.tobytes()
        image_texture = Texture.create(
            size=(frame.shape[1], frame.shape[0]), colorfmt='bgr')
        image_texture.blit_buffer(buf, colorfmt='bgr', bufferfmt='ubyte')
        self.texture = image_texture
    
    def get_last_frame_b64(self) -> str:
        """Get the last frame as base64 string for broadcast."""
        return self.last_frame_b64
