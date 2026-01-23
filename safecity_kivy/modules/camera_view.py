"""
CameraView - Kivy Widget for OpenCV Camera Integration with Threat Detection.

This module provides a Kivy Image widget that captures video frames from 
a camera using OpenCV, runs threat detection via ThreatDetector, and 
displays the annotated frames in real-time.
"""

import cv2
import base64
import numpy as np
from io import BytesIO
from PIL import Image

from kivy.uix.image import Image as KivyImage
from kivy.properties import StringProperty, NumericProperty, ObjectProperty
from kivy.clock import Clock
from kivy.graphics.texture import Texture

from safecity_core.vision.detector import ThreatDetector


class CameraView(KivyImage):
    """
    A Kivy widget that displays live camera feed with threat detection overlay.
    
    Properties:
        threat_level (str): Current threat level ("SAFE", "WARNING", "DANGER")
        detected_action (str): Currently detected action (e.g., "punch", "kick")
        is_running (bool): Whether the camera is currently capturing
    """
    
    # Kivy Properties for data binding
    threat_level = StringProperty("SAFE")
    detected_action = StringProperty("None")
    action_confidence = NumericProperty(0.0)
    is_sneak_attack = ObjectProperty(False)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        self.capture = None
        self.detector = None
        self.is_running = False
        self.camera_index = 0
        self._last_frame_b64 = ""
        self._update_event = None
        
        # Initialize with a placeholder texture
        self._create_placeholder()
    
    def _create_placeholder(self):
        """Create a dark placeholder texture when camera is not active."""
        # Create a dark gray placeholder image
        placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
        placeholder[:] = (30, 30, 30)  # Dark gray
        
        # Add text
        cv2.putText(
            placeholder, 
            "Camera Off", 
            (220, 240),
            cv2.FONT_HERSHEY_SIMPLEX, 
            1.2, 
            (100, 100, 100), 
            2
        )
        
        self._update_texture(placeholder)
    
    def _update_texture(self, frame: np.ndarray):
        """Convert an OpenCV frame to a Kivy texture and update the widget."""
        # Convert BGR to RGB
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        else:
            frame_rgb = frame
        
        # Flip vertically for Kivy (Kivy uses bottom-left origin)
        frame_flipped = cv2.flip(frame_rgb, 0)
        
        # Create texture
        h, w = frame_flipped.shape[:2]
        texture = Texture.create(size=(w, h), colorfmt='rgb')
        texture.blit_buffer(frame_flipped.tobytes(), colorfmt='rgb', bufferfmt='ubyte')
        
        self.texture = texture
    
    def start(self, camera_index: int = 0):
        """
        Start the camera capture and threat detection.
        
        Args:
            camera_index: Index of the camera to use (0 = default webcam)
        """
        if self.is_running:
            print("[CameraView] Already running, ignoring start()")
            return
        
        self.camera_index = camera_index
        
        # Initialize video capture
        print(f"[CameraView] Opening camera index {camera_index}...")
        self.capture = cv2.VideoCapture(camera_index)
        
        if not self.capture.isOpened():
            print(f"[CameraView] ERROR: Failed to open camera {camera_index}")
            self._show_error("Camera Error")
            return
        
        # Set resolution (optional, adjust as needed)
        self.capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # Initialize threat detector
        print("[CameraView] Initializing ThreatDetector...")
        try:
            self.detector = ThreatDetector()
        except Exception as e:
            print(f"[CameraView] ERROR: Failed to initialize ThreatDetector: {e}")
            self.detector = None
        
        self.is_running = True
        
        # Schedule frame updates at ~30 FPS
        print("[CameraView] Starting frame updates...")
        self._update_event = Clock.schedule_interval(self._update_frame, 1.0 / 30.0)
    
    def stop(self):
        """Stop the camera capture and release resources."""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # Cancel scheduled updates
        if self._update_event:
            self._update_event.cancel()
            self._update_event = None
        
        # Release camera
        if self.capture:
            self.capture.release()
            self.capture = None
        
        # Reset properties
        self.threat_level = "SAFE"
        self.detected_action = "None"
        self.action_confidence = 0.0
        self.is_sneak_attack = False
        
        # Show placeholder
        self._create_placeholder()
        
        print("[CameraView] Stopped.")
    
    def _update_frame(self, dt):
        """Called every frame to capture, process, and display."""
        if not self.is_running or not self.capture:
            return
        
        ret, frame = self.capture.read()
        if not ret:
            print("[CameraView] Failed to read frame")
            return
        
        # Process frame through threat detector
        if self.detector:
            try:
                result = self.detector.process_frame(frame)
                
                # Update properties for data binding
                self.threat_level = result.threat_level
                self.detected_action = result.detected_action or "None"
                self.action_confidence = result.action_confidence
                self.is_sneak_attack = result.is_sneak_attack
                
                # Use annotated frame
                display_frame = result.annotated_frame
            except Exception as e:
                print(f"[CameraView] Detection error: {e}")
                display_frame = frame
        else:
            display_frame = frame
        
        # Store frame as base64 for potential SOS broadcast
        self._store_frame_b64(display_frame)
        
        # Update texture
        self._update_texture(display_frame)
    
    def _store_frame_b64(self, frame: np.ndarray):
        """Store the current frame as base64 encoded JPEG for SOS broadcast."""
        try:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            buffered = BytesIO()
            pil_image.save(buffered, format="JPEG", quality=75)
            self._last_frame_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        except Exception:
            pass
    
    def get_last_frame_b64(self) -> str:
        """
        Get the last captured frame as a base64 encoded JPEG string.
        Used for SOS broadcast feature.
        
        Returns:
            Base64 encoded JPEG string of the last frame
        """
        return self._last_frame_b64
    
    def _show_error(self, message: str):
        """Display an error message on the camera view."""
        error_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        error_frame[:] = (40, 20, 20)  # Dark red
        
        cv2.putText(
            error_frame, 
            message, 
            (180, 240),
            cv2.FONT_HERSHEY_SIMPLEX, 
            1.5, 
            (100, 100, 255), 
            2
        )
        
        self._update_texture(error_frame)
