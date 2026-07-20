from __future__ import annotations

import csv
import logging
import os
import threading
from dataclasses import dataclass, field
from math import gcd
from typing import ClassVar

import numpy as np
from scipy.signal import resample_poly

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AudioInference:
    distress_score: float = 0.0
    persistent_ratio: float = 0.0
    media_score: float = 0.0
    top_classes: list[tuple[str, float]] = field(default_factory=list)
    factors: list[str] = field(default_factory=list)
    available: bool = False


class YamnetAudioClassifier:
    """Lazy, thread-safe YAMNet inference optimized for short mono PCM windows."""

    DISTRESS_LABELS: ClassVar[dict[str, float]] = {
        "screaming": 1.00,
        "scream": 1.00,
        "shout": 0.78,
        "yell": 0.80,
        "crying, sobbing": 0.72,
        "wail, moan": 0.70,
        "whimper": 0.62,
        "gunshot, gunfire": 0.95,
        "explosion": 0.90,
        "glass": 0.62,
    }
    MEDIA_LABELS: ClassVar[set[str]] = {
        "music",
        "television",
        "radio",
        "video game music",
        "sound effect",
    }

    def __init__(self, model_url: str, threads: int = 2) -> None:
        self.model_url = model_url
        self.threads = threads
        self._model = None
        self._class_names: list[str] = []
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()
        self.load_error: str | None = None

    @property
    def ready(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        if self.ready:
            return
        with self._load_lock:
            if self.ready:
                return
            try:
                import tensorflow as tf
                import tensorflow_hub as hub

                tf.config.threading.set_inter_op_parallelism_threads(self.threads)
                tf.config.threading.set_intra_op_parallelism_threads(self.threads)
                self._model = hub.load(self.model_url)
                class_map_path = self._model.class_map_path().numpy()
                if isinstance(class_map_path, bytes):
                    class_map_path = class_map_path.decode("utf-8")
                with open(class_map_path, encoding="utf-8") as class_map:
                    self._class_names = [row["display_name"] for row in csv.DictReader(class_map)]
                self.load_error = None
                logger.info("Loaded YAMNet with %s audio classes", len(self._class_names))
            except Exception as exc:  # Model download/runtime failure must degrade safely.
                self._model = None
                self.load_error = str(exc)
                logger.exception("Could not load YAMNet")
                raise

    @staticmethod
    def _waveform(pcm_bytes: bytes, sample_rate: int) -> np.ndarray:
        if len(pcm_bytes) < 2:
            return np.array([], dtype=np.float32)
        audio = np.frombuffer(pcm_bytes[: len(pcm_bytes) - len(pcm_bytes) % 2], dtype="<i2")
        waveform = audio.astype(np.float32) / np.iinfo(np.int16).max
        if sample_rate != 16_000 and waveform.size:
            divisor = gcd(sample_rate, 16_000)
            waveform = resample_poly(waveform, 16_000 // divisor, sample_rate // divisor)
        return np.clip(waveform, -1.0, 1.0).astype(np.float32, copy=False)

    def infer(self, pcm_bytes: bytes, sample_rate: int) -> AudioInference:
        waveform = self._waveform(pcm_bytes, sample_rate)
        if waveform.size < 4_000:
            return AudioInference()
        if not self.ready:
            self.load()
        assert self._model is not None

        with self._infer_lock:
            scores, _, _ = self._model(waveform)
        frame_scores = np.asarray(scores, dtype=np.float32)
        if frame_scores.ndim != 2 or not frame_scores.size:
            return AudioInference()

        mean_scores = frame_scores.mean(axis=0)
        top_indices = np.argsort(mean_scores)[::-1][:8]
        top_classes = [
            (self._class_names[index], float(mean_scores[index])) for index in top_indices
        ]

        weighted_scores: list[float] = []
        positive_frame_scores = np.zeros(frame_scores.shape[0], dtype=np.float32)
        for index, label in enumerate(self._class_names):
            normalized = label.casefold()
            weight = next(
                (
                    value
                    for candidate, value in self.DISTRESS_LABELS.items()
                    if candidate in normalized
                ),
                None,
            )
            if weight is not None:
                weighted_scores.append(float(np.quantile(frame_scores[:, index], 0.8)) * weight)
                positive_frame_scores = np.maximum(
                    positive_frame_scores,
                    frame_scores[:, index] * weight,
                )

        media_score = max(
            (
                float(mean_scores[index])
                for index, label in enumerate(self._class_names)
                if any(media in label.casefold() for media in self.MEDIA_LABELS)
            ),
            default=0.0,
        )
        raw_distress = max(weighted_scores, default=0.0)
        persistent_ratio = float(np.mean(positive_frame_scores >= 0.42))
        persistence_gain = 0.75 + 0.25 * min(persistent_ratio / 0.5, 1.0)
        media_penalty = max(0.55, 1.0 - max(media_score - raw_distress * 0.65, 0.0) * 0.75)
        distress_score = float(np.clip(raw_distress * persistence_gain * media_penalty, 0.0, 1.0))

        factors = [
            f"Audio: {label} ({score:.0%})"
            for label, score in top_classes[:3]
            if score >= 0.18
        ]
        if media_score >= 0.35:
            factors.append(f"Possible media playback ({media_score:.0%})")
        return AudioInference(
            distress_score=distress_score,
            persistent_ratio=persistent_ratio,
            media_score=media_score,
            top_classes=top_classes,
            factors=factors,
            available=True,
        )
