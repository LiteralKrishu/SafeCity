
import cv2
import mediapipe as mp
import numpy as np
from dataclasses import dataclass
from typing import Tuple, List, Optional
import time

@dataclass
class DetectionResult:
    annotated_frame: np.ndarray
    threat_level: str  # SAFE, WARNING, DANGER
    message: str
    is_sneak_attack: bool

class ThreatDetector:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp.solutions.drawing_utils
        self.prev_gray = None
        self.movement_threshold = 5000 # Sensitivity for motion detection
        self.last_threat_time = 0
        self.threat_cooldown = 5.0 # Seconds to hold threat state
        
        # Sneak Attack Logic
        self.shoulder_width_history = []
        self.history_size = 30 # Approx 1 second @ 30fps

    def detect_motion(self, frame: np.ndarray, gray: np.ndarray) -> bool:
        if self.prev_gray is None:
            self.prev_gray = gray
            return False

        frame_delta = cv2.absdiff(self.prev_gray, gray)
        thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        motion_pixels = cv2.countNonZero(thresh)
        
        self.prev_gray = gray
        return motion_pixels > self.movement_threshold

    def detect_sneak_attack(self, landmarks, frame_width: int) -> bool:
        if not landmarks:
            return False

        # Get keypoints
        left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
        right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
        
        # 1. "Center" Check: Is the person roughly centered horizontally?
        # Landmarks are normalized [0.0, 1.0]
        midpoint_x = (left_shoulder.x + right_shoulder.x) / 2
        is_centered = 0.3 < midpoint_x < 0.7

        # 2. "Approach" Check: Are shoulders getting wider? (Looming effect)
        width = abs(left_shoulder.x - right_shoulder.x)
        self.shoulder_width_history.append(width)
        if len(self.shoulder_width_history) > self.history_size:
            self.shoulder_width_history.pop(0)

        # Simple trend analysis: Compare recent avg width to older avg width
        if len(self.shoulder_width_history) == self.history_size:
            recent_avg = np.mean(self.shoulder_width_history[-10:])
            older_avg = np.mean(self.shoulder_width_history[:10])
            
            # If width increased significantly (> 1.2x) and is centered
            is_approaching = recent_avg > (older_avg * 1.1)
            
            return is_centered and is_approaching
            
        return False

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        result_message = ""
        threat_level = "SAFE"
        is_sneak_attack = False
        
        # Flip frame for mirror effect (optional, implies webcam usage)
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape
        
        # 1. Motion Detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        is_moving = self.detect_motion(frame, gray)
        
        # 2. Pose Detection
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.pose.process(rgb_frame)
        rgb_frame.flags.writeable = True

        # Draw Pose Landmarks
        if results.pose_landmarks:
            self.mp_drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(245, 117, 66), thickness=2, circle_radius=2),
                self.mp_drawing.DrawingSpec(color=(245, 66, 230), thickness=2, circle_radius=2)
            )
            
            # Check for Sneak Attack
            if self.detect_sneak_attack(results.pose_landmarks.landmark, w):
                is_sneak_attack = True
                threat_level = "DANGER"
                result_message = "SNEAK ATTACK DETECTED!"
                self.last_threat_time = time.time()
                
                # Draw Visual Warning
                cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), 10)
                cv2.putText(frame, "THREAT BEHIND YOU!", (50, 50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # 3. Motion Warning (if no sneak attack but significant movement)
        if is_moving and threat_level == "SAFE":
            threat_level = "WARNING"
            result_message = "Motion Detected"
            # Draw Yellow Border
            cv2.rectangle(frame, (0,0), (w,h), (0, 255, 255), 5)

        # 4. Persistence (Keep Red/Yellow alert active for a few seconds)
        if time.time() - self.last_threat_time < self.threat_cooldown:
            if threat_level == "SAFE": # Don't downgrade if we just detected something
                threat_level = "WARNING"
                
        return DetectionResult(
            annotated_frame=frame,
            threat_level=threat_level,
            message=result_message,
            is_sneak_attack=is_sneak_attack
        )
