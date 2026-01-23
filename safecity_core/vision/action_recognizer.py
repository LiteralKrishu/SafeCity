"""
Action Recognition using ONNX Runtime

This module provides lightweight action recognition using ONNX-exported models.
Designed to detect dangerous actions like fighting, falling, or running.
"""

import numpy as np
import cv2
from typing import Optional, List, Tuple
from dataclasses import dataclass
from collections import deque
import threading


@dataclass
class ActionResult:
    """Result of action recognition."""
    action: str
    confidence: float
    is_dangerous: bool


class ActionRecognizer:
    """
    Lightweight action recognition using ONNX Runtime.
    
    Uses a sliding window of frames to recognize temporal actions.
    """
    
    # Action labels (common action recognition datasets)
    KINETICS_ACTIONS = {
        # Dangerous actions (CRITICAL triggers)
        "punching person (boxing)": "fighting",
        "slapping": "hitting",
        "pushing cart": "pushing",
        "kicking person": "fighting",
        "headbutting": "fighting",
        "wrestling": "fighting",
        
        # Warning actions
        "falling": "falling",
        "tripping": "falling",
        "running": "running",
        "being pushed": "pushing",
        
        # Safe actions (for context)
        "walking": "walking",
        "standing": "standing",
        "sitting": "sitting",
        "waving hand": "waving",
    }
    
    DANGEROUS_ACTIONS = {"violent_shaking", "impact", "fighting", "hitting", "attacking", "stabbing", "kicking"}
    WARNING_ACTIONS = {"running", "falling", "pushing", "tripping"}
    
    def __init__(self, model_path: Optional[str] = None, buffer_size: int = 16):
        """
        Initialize the action recognizer.
        
        Args:
            model_path: Path to ONNX model file. If None, uses fallback heuristics.
            buffer_size: Number of frames to buffer for temporal analysis.
        """
        self.model_path = model_path
        self.buffer_size = buffer_size
        self.session = None
        self.frame_buffer: deque = deque(maxlen=buffer_size)
        self.lock = threading.Lock()
        
        # Motion history for heuristic fallback
        self.motion_history: deque = deque(maxlen=30)
        self.prev_gray = None
        
        self._load_model()
    
    def _load_model(self):
        """Load the ONNX model if available."""
        if self.model_path is None:
            print("ActionRecognizer: No model path provided, using motion heuristics.")
            return
            
        try:
            import onnxruntime as ort
            self.session = ort.InferenceSession(
                self.model_path,
                providers=['CPUExecutionProvider']
            )
            print(f"Loaded action recognition model: {self.model_path}")
        except Exception as e:
            print(f"Failed to load ONNX model: {e}. Using motion heuristics.")
            self.session = None
    
    def _preprocess_frames(self, frames: List[np.ndarray]) -> np.ndarray:
        """Preprocess frames for model input."""
        processed = []
        target_size = (224, 224)
        
        for frame in frames:
            # Resize
            resized = cv2.resize(frame, target_size)
            # Normalize to [0, 1]
            normalized = resized.astype(np.float32) / 255.0
            # Convert BGR to RGB
            rgb = normalized[:, :, ::-1]
            processed.append(rgb)
        
        # Stack and transpose to (batch, channels, frames, height, width)
        stacked = np.stack(processed, axis=0)
        # (frames, H, W, C) -> (1, C, frames, H, W)
        transposed = np.transpose(stacked, (3, 0, 1, 2))
        return np.expand_dims(transposed, axis=0).astype(np.float32)
    
    def _compute_motion_score(self, frame: np.ndarray) -> float:
        """Compute motion magnitude using optical flow approximation."""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self.prev_gray is None:
            self.prev_gray = gray
            return 0.0
        
        # Frame difference as motion proxy
        frame_delta = cv2.absdiff(self.prev_gray, gray)
        thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        motion_pixels = cv2.countNonZero(thresh)
        
        self.prev_gray = gray
        
        # Normalize by frame size
        h, w = gray.shape
        motion_ratio = motion_pixels / (h * w)
        return motion_ratio
    
    def _detect_action_heuristic(self) -> ActionResult:
        """
        Fallback heuristic-based action detection using motion analysis.
        
        Uses motion patterns to infer potential actions.
        ADJUSTED: Much higher thresholds to reduce false positives.
        Only truly violent shaking/running will trigger.
        """
        if len(self.motion_history) < 10:
            return ActionResult(action="unknown", confidence=0.0, is_dangerous=False)
        
        recent_motion = list(self.motion_history)[-10:]
        avg_motion = np.mean(recent_motion)
        max_motion = np.max(recent_motion)
        motion_variance = np.var(recent_motion)
        
        # VIOLENT SHAKING: Extremely high, erratic motion -> potential danger
        # Threshold increased from 0.15 to 0.35 (more than doubled)
        if avg_motion > 0.35 and motion_variance > 0.03:
            return ActionResult(
                action="violent_shaking",
                confidence=min(0.8, avg_motion * 2),
                is_dangerous=True
            )
        
        # FAST RUNNING: Sustained very high motion
        # Threshold increased from 0.08 to 0.25
        if avg_motion > 0.25 and motion_variance < 0.02:
            return ActionResult(
                action="running",
                confidence=0.7,
                is_dangerous=True  # Running could indicate fleeing danger
            )
        
        # SUDDEN IMPACT: Very sudden spike in motion -> fall or phone knocked
        # Threshold increased from 0.25 to 0.40
        if max_motion > 0.40 and avg_motion < 0.15:
            return ActionResult(
                action="impact",
                confidence=0.6,
                is_dangerous=True
            )
        
        # Normal walking/movement - not dangerous
        if avg_motion > 0.05:
            return ActionResult(
                action="walking",
                confidence=0.6,
                is_dangerous=False
            )
        
        # Low motion -> standing still
        return ActionResult(action="standing", confidence=0.8, is_dangerous=False)
    
    def process_frame(self, frame: np.ndarray) -> Optional[ActionResult]:
        """
        Process a single frame and return action if detected.
        
        Args:
            frame: BGR image from OpenCV
            
        Returns:
            ActionResult if enough frames buffered, None otherwise
        """
        with self.lock:
            # Add to buffer
            self.frame_buffer.append(frame.copy())
            
            # Compute motion
            motion = self._compute_motion_score(frame)
            self.motion_history.append(motion)
            
            # Need full buffer for analysis
            if len(self.frame_buffer) < self.buffer_size:
                return None
            
            # If we have a model, use it
            if self.session is not None:
                return self._run_model_inference()
            else:
                # Use heuristic fallback
                return self._detect_action_heuristic()
    
    def _run_model_inference(self) -> ActionResult:
        """Run ONNX model inference on buffered frames."""
        try:
            frames = list(self.frame_buffer)
            input_data = self._preprocess_frames(frames)
            
            input_name = self.session.get_inputs()[0].name
            outputs = self.session.run(None, {input_name: input_data})
            
            # Get prediction
            logits = outputs[0][0]
            probs = self._softmax(logits)
            pred_idx = np.argmax(probs)
            confidence = probs[pred_idx]
            
            # Map to action label (simplified - real model would have label mapping)
            action = f"action_{pred_idx}"
            is_dangerous = action in self.DANGEROUS_ACTIONS
            
            return ActionResult(
                action=action,
                confidence=float(confidence),
                is_dangerous=is_dangerous
            )
            
        except Exception as e:
            print(f"Model inference error: {e}")
            return self._detect_action_heuristic()
    
    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        """Compute softmax values."""
        e_x = np.exp(x - np.max(x))
        return e_x / e_x.sum()
    
    def get_danger_level(self, action: str) -> str:
        """
        Get the danger level for an action.
        
        Returns: "CRITICAL", "WARNING", or "SAFE"
        """
        action_lower = action.lower()
        if action_lower in self.DANGEROUS_ACTIONS:
            return "CRITICAL"
        elif action_lower in self.WARNING_ACTIONS:
            return "WARNING"
        return "SAFE"
    
    def reset(self):
        """Reset the frame buffer and motion history."""
        with self.lock:
            self.frame_buffer.clear()
            self.motion_history.clear()
            self.prev_gray = None


# Global instance
_action_recognizer: Optional[ActionRecognizer] = None
_recognizer_lock = threading.Lock()


def get_action_recognizer(model_path: Optional[str] = None) -> ActionRecognizer:
    """Get or create the global action recognizer instance."""
    global _action_recognizer
    with _recognizer_lock:
        if _action_recognizer is None:
            _action_recognizer = ActionRecognizer(model_path=model_path)
        return _action_recognizer


def recognize_action(frame: np.ndarray) -> Optional[ActionResult]:
    """
    Convenience function to recognize action in a frame.
    
    Args:
        frame: BGR image from OpenCV
        
    Returns:
        ActionResult if detected, None if still buffering
    """
    recognizer = get_action_recognizer()
    return recognizer.process_frame(frame)
