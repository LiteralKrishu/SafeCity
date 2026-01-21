"""
Local Threat Verification using YOLOv8

This module provides local AI-based threat verification without requiring
external API calls. It uses:
- YOLOv8 for object detection (people, potential weapons)
- Pose analysis for behavior assessment
- Rule-based logic for threat determination
"""

import numpy as np
import cv2
from typing import TypedDict, List, Tuple, Optional
from dataclasses import dataclass
import threading


class ThreatContext(TypedDict):
    is_confirmed_threat: bool
    description: str
    action_recommendation: str
    detected_objects: List[str]
    confidence: float


@dataclass
class Detection:
    label: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2


class LocalThreatVerifier:
    """
    Local threat verification using YOLOv8 object detection.

    Detects:
    - People and their proximity/behavior
    - Potential weapons (knives, scissors, etc.)
    - Suspicious objects
    """

    # COCO class IDs for threat-related objects
    PERSON_CLASS = 0
    WEAPON_CLASSES = {
        # Common objects that could be weapons (from COCO dataset)
        43: "knife",
        76: "scissors",
        # Objects that might indicate danger
        39: "bottle",  # Could be used as weapon
    }

    # Objects that might indicate a threat context
    SUSPICIOUS_CLASSES = {
        24: "backpack",  # In certain contexts
        26: "handbag",
        28: "suitcase",
    }

    def __init__(self, model_size: str = "n"):
        """
        Initialize the local verifier.

        Args:
            model_size: YOLO model size - "n" (nano), "s" (small), "m" (medium)
                       Smaller = faster, larger = more accurate
        """
        self.model = None
        self.model_size = model_size
        self.lock = threading.Lock()
        self._load_model()

    def _load_model(self):
        """Load the YOLO model."""
        try:
            from ultralytics import YOLO
            # Use YOLOv8 nano for speed, can upgrade to 's' or 'm' for accuracy
            self.model = YOLO(f"yolov8{self.model_size}.pt")
            print(f"Loaded YOLOv8{self.model_size} model for local threat detection")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")
            self.model = None

    def detect_objects(self, frame: np.ndarray) -> List[Detection]:
        """
        Run object detection on a frame.

        Args:
            frame: BGR image from OpenCV

        Returns:
            List of Detection objects
        """
        if self.model is None:
            return []

        with self.lock:
            try:
                # Run inference (verbose=False to suppress output)
                results = self.model(frame, verbose=False)

                detections = []
                for result in results:
                    boxes = result.boxes
                    if boxes is None:
                        continue

                    for i, box in enumerate(boxes):
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        xyxy = box.xyxy[0].cpu().numpy().astype(int)

                        # Get class name
                        label = result.names.get(cls_id, f"class_{cls_id}")

                        detections.append(Detection(
                            label=label,
                            confidence=conf,
                            bbox=tuple(xyxy)
                        ))

                return detections

            except Exception as e:
                print(f"Detection error: {e}")
                return []

    def analyze_threat(self,
                       frame: np.ndarray,
                       pose_landmarks: Optional[List] = None,
                       is_approaching: bool = False) -> ThreatContext:
        """
        Analyze a frame for potential threats.

        Args:
            frame: BGR image from OpenCV
            pose_landmarks: Optional pose landmarks from MediaPipe
            is_approaching: Whether someone is detected approaching (from sneak attack detection)

        Returns:
            ThreatContext with threat assessment
        """
        detections = self.detect_objects(frame)

        # Categorize detections
        people = []
        weapons = []
        suspicious = []
        all_objects = []

        for det in detections:
            all_objects.append(f"{det.label} ({det.confidence:.0%})")

            if det.label == "person":
                people.append(det)
            elif det.label in ["knife", "scissors"]:
                weapons.append(det)
            elif det.label in ["bottle", "baseball bat", "tennis racket"]:
                # Objects that could be used as weapons
                if det.confidence > 0.5:
                    suspicious.append(det)

        # Threat assessment logic
        threat_score = 0
        threat_reasons = []

        # Factor 1: Multiple people detected
        if len(people) > 1:
            threat_score += 20
            threat_reasons.append(f"{len(people)} people detected")

        # Factor 2: Weapons detected
        if weapons:
            threat_score += 50
            weapon_names = [w.label for w in weapons]
            threat_reasons.append(f"Potential weapon: {', '.join(weapon_names)}")

        # Factor 3: Someone approaching from behind
        if is_approaching:
            threat_score += 30
            threat_reasons.append("Person approaching from behind")

        # Factor 4: Person very close (large bounding box)
        for person in people:
            x1, y1, x2, y2 = person.bbox
            h, w = frame.shape[:2]
            person_area = (x2 - x1) * (y2 - y1)
            frame_area = h * w

            if person_area > frame_area * 0.3:  # Person takes >30% of frame
                threat_score += 25
                threat_reasons.append("Person in close proximity")
                break

        # Factor 5: Suspicious objects
        if suspicious:
            threat_score += 10
            threat_reasons.append(f"Suspicious object: {suspicious[0].label}")

        # Determine threat level
        is_threat = threat_score >= 40

        # Generate description
        if threat_reasons:
            description = "; ".join(threat_reasons)
        else:
            description = "No immediate threats detected"

        # Generate recommendation
        if threat_score >= 60:
            recommendation = "DANGER: Move to safety immediately. Consider calling for help."
        elif threat_score >= 40:
            recommendation = "WARNING: Stay alert and be prepared to move to safety."
        elif threat_score >= 20:
            recommendation = "CAUTION: Monitor your surroundings."
        else:
            recommendation = "Scene appears safe. Continue monitoring."

        return ThreatContext(
            is_confirmed_threat=is_threat,
            description=description,
            action_recommendation=recommendation,
            detected_objects=all_objects,
            confidence=min(threat_score / 100, 1.0)
        )

    def verify_frame(self, image_bytes: bytes) -> ThreatContext:
        """
        Verify a threat from image bytes (compatible with existing API).

        Args:
            image_bytes: JPEG encoded image bytes

        Returns:
            ThreatContext with threat assessment
        """
        try:
            # Decode image
            nparr = np.frombuffer(image_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                return ThreatContext(
                    is_confirmed_threat=False,
                    description="Failed to decode image",
                    action_recommendation="Stay alert",
                    detected_objects=[],
                    confidence=0.0
                )

            return self.analyze_threat(frame)

        except Exception as e:
            print(f"Local verification error: {e}")
            return ThreatContext(
                is_confirmed_threat=False,
                description=f"Verification error: {str(e)}",
                action_recommendation="Stay alert",
                detected_objects=[],
                confidence=0.0
            )


# Global instance (lazy loaded)
_local_verifier: Optional[LocalThreatVerifier] = None
_verifier_lock = threading.Lock()


def get_local_verifier() -> LocalThreatVerifier:
    """Get or create the global local verifier instance."""
    global _local_verifier
    with _verifier_lock:
        if _local_verifier is None:
            _local_verifier = LocalThreatVerifier(model_size="n")
        return _local_verifier


def verify_local(image_bytes: bytes) -> ThreatContext:
    """
    Verify a threat locally using YOLOv8.

    This is a drop-in replacement for the Gemini-based verification.

    Args:
        image_bytes: JPEG encoded image bytes

    Returns:
        ThreatContext with threat assessment
    """
    verifier = get_local_verifier()
    return verifier.verify_frame(image_bytes)
