
from kivy.uix.image import Image
from kivy.graphics.texture import Texture
from kivy.clock import Clock, mainthread
from kivy.properties import ObjectProperty, StringProperty, BooleanProperty
import cv2
import numpy as np
import threading
import time
from safecity_core.vision.detector import ThreatDetector

class CameraView(Image):
    detector = ObjectProperty(None)
    threat_level = StringProperty("SAFE")
    message = StringProperty("")
    
    def __init__(self, **kwargs):
        super(CameraView, self).__init__(**kwargs)
        self.capture = None
        self.detector = ThreatDetector()
        self.fps = 30
        self.is_active = False
        self.thread = None
        self.stop_event = threading.Event()

    def start(self, camera_index=0):
        if not self.is_active:
            self.capture = cv2.VideoCapture(camera_index)
            self.is_active = True
            self.stop_event.clear()
            self.thread = threading.Thread(target=self.process_video_loop)
            self.thread.daemon = True
            self.thread.start()

    def stop(self):
        self.is_active = False
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None
        if self.capture:
            self.capture.release()
            self.capture = None

    def process_video_loop(self):
        while not self.stop_event.is_set() and self.capture and self.capture.isOpened():
            ret, frame = self.capture.read()
            if ret:
                # Heavy processing off-thread
                result = self.detector.process_frame(frame)
                
                # Update UI on Main Thread
                self.update_ui(result.annotated_frame, result.threat_level, result.message)
            
            # Limit FPS roughly
            time.sleep(1.0 / self.fps)

    @mainthread
    def update_ui(self, frame, threat_level, message):
        # Update Properties
        self.threat_level = threat_level
        self.message = message
        
        # Texture Update
        buf1 = cv2.flip(frame, 0)
        buf = buf1.tostring()
        image_texture = Texture.create(
            size=(frame.shape[1], frame.shape[0]), colorfmt='bgr')
        image_texture.blit_buffer(buf, colorfmt='bgr', bufferfmt='ubyte')
        self.texture = image_texture

