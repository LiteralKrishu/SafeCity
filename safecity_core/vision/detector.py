
import cv2
import mediapipe as mp
import numpy as np
from dataclasses import dataclass
from typing import Tuple, List, Optional
import time
import os

# New MediaPipe Tasks API imports
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Action recognition
from safecity_core.vision.action_recognizer import get_action_recognizer, ActionResult

@dataclass
class DetectionResult:
    annotated_frame: np.ndarray
    threat_level: str  # SAFE, WARNING, DANGER
    message: str
    is_sneak_attack: bool
    detected_action: Optional[str] = None
    action_confidence: float = 0.0


# Pose landmark indices (same as old PoseLandmark enum)
class PoseLandmark:
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24

class ThreatDetector:
    def __init__(self):
        # Get the model path
        model_path = self._get_model_path()

        # Configure the pose landmarker
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            output_segmentation_masks=False,
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            num_poses=1
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(options)

        self.prev_gray = None

        # Load from config
        from safecity_core.config import config
        self.movement_threshold = config.vision.get("movement_threshold", 5000)
        self.threat_cooldown = config.vision.get("threat_cooldown", 5.0)
        self.history_size = config.vision.get("history_size", 30)

        self.last_threat_time = 0

        # Sneak Attack Logic
        self.shoulder_width_history = []

        # Drawing specs
        self.landmark_color = (245, 117, 66)
        self.connection_color = (245, 66, 230)
        
        # Action Recognition
        self.action_recognizer = get_action_recognizer()
        self.last_action: Optional[ActionResult] = None


    def _get_model_path(self) -> str:
        """Get the path to the pose landmarker model."""
        # Try multiple locations
        possible_paths = [
            os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models', 'pose_landmarker_lite.task'),
            os.path.join(os.getcwd(), 'assets', 'models', 'pose_landmarker_lite.task'),
            'assets/models/pose_landmarker_lite.task',
        ]

        for path in possible_paths:
            if os.path.exists(path):
                return os.path.abspath(path)

        raise FileNotFoundError(
            "Pose landmarker model not found. Please download it:\n"
            "curl -L -o assets/models/pose_landmarker_lite.task "
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
        )

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
        if not landmarks or len(landmarks) == 0:
            return False

        pose_landmarks = landmarks[0]  # Get first detected pose

        # Get keypoints (landmarks are normalized [0.0, 1.0])
        left_shoulder = pose_landmarks[PoseLandmark.LEFT_SHOULDER]
        right_shoulder = pose_landmarks[PoseLandmark.RIGHT_SHOULDER]

        # 1. "Center" Check: Is the person roughly centered horizontally?
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

            # If width increased significantly (> 1.1x) and is centered
            is_approaching = recent_avg > (older_avg * 1.1)

            return is_centered and is_approaching

        return False

    def _draw_landmarks(self, frame: np.ndarray, landmarks) -> None:
        """Draw pose landmarks on the frame."""
        if not landmarks or len(landmarks) == 0:
            return

        h, w, _ = frame.shape
        pose_landmarks = landmarks[0]

        # Draw landmarks as circles
        for landmark in pose_landmarks:
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            cv2.circle(frame, (x, y), 4, self.landmark_color, -1)

        # Define connections (simplified pose skeleton)
        connections = [
            (PoseLandmark.LEFT_SHOULDER, PoseLandmark.RIGHT_SHOULDER),
            (PoseLandmark.LEFT_SHOULDER, PoseLandmark.LEFT_HIP),
            (PoseLandmark.RIGHT_SHOULDER, PoseLandmark.RIGHT_HIP),
            (PoseLandmark.LEFT_HIP, PoseLandmark.RIGHT_HIP),
        ]

        # Draw connections
        for start_idx, end_idx in connections:
            if start_idx < len(pose_landmarks) and end_idx < len(pose_landmarks):
                start = pose_landmarks[start_idx]
                end = pose_landmarks[end_idx]
                start_point = (int(start.x * w), int(start.y * h))
                end_point = (int(end.x * w), int(end.y * h))
                cv2.line(frame, start_point, end_point, self.connection_color, 2)

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        result_message = ""
        threat_level = "SAFE"
        is_sneak_attack = False
        detected_action = None
        action_confidence = 0.0

        # Flip frame for mirror effect (optional, implies webcam usage)
        frame = cv2.flip(frame, 1)
        h, w, _ = frame.shape

        # 1. Motion Detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        is_moving = self.detect_motion(frame, gray)

        # 2. Pose Detection using new Tasks API
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        detection_result = self.pose_landmarker.detect(mp_image)

        # Draw Pose Landmarks
        if detection_result.pose_landmarks:
            self._draw_landmarks(frame, detection_result.pose_landmarks)

            # Check for Sneak Attack
            if self.detect_sneak_attack(detection_result.pose_landmarks, w):
                is_sneak_attack = True
                threat_level = "DANGER"
                result_message = "SNEAK ATTACK DETECTED!"
                self.last_threat_time = time.time()

                # Draw Visual Warning
                cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), 10)
                cv2.putText(frame, "THREAT BEHIND YOU!", (50, 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

        # 3. Action Recognition
        action_result = self.action_recognizer.process_frame(frame)
        if action_result:
            self.last_action = action_result
            detected_action = action_result.action
            action_confidence = action_result.confidence
            
            # Escalate threat level based on action
            if action_result.is_dangerous and threat_level != "DANGER":
                threat_level = "DANGER"
                result_message = f"DANGEROUS ACTION: {action_result.action.upper()}!"
                self.last_threat_time = time.time()
                
                # Draw visual warning for dangerous action
                cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), 10)
                cv2.putText(frame, f"ACTION: {action_result.action.upper()}", (50, h - 50),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            # Only escalate to WARNING for running (not other warning actions)
            # to reduce false positives from normal walking
            elif action_result.action == "running" and action_result.confidence > 0.65:
                if threat_level == "SAFE":
                    threat_level = "WARNING"
                    result_message = f"Activity: {action_result.action}"
                    cv2.rectangle(frame, (0, 0), (w, h), (0, 255, 255), 5)

        # 4. Motion Detection - tracked internally but no alert
        # (Removed motion-based WARNING to reduce false positives from minor movements)

        # 5. Persistence (Keep Red/Yellow alert active for a few seconds)
        if time.time() - self.last_threat_time < self.threat_cooldown:
            if threat_level == "SAFE": # Don't downgrade if we just detected something
                threat_level = "WARNING"

        return DetectionResult(
            annotated_frame=frame,
            threat_level=threat_level,
            message=result_message,
            is_sneak_attack=is_sneak_attack,
            detected_action=detected_action,
            action_confidence=action_confidence
        )

