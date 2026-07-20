from pathlib import Path

from app.core.schemas import AnalyzeMetadata, ContextFeatures, MotionFeatures
from app.detection.audio import AudioInference
from app.detection.fusion import FusionEngine
from app.detection.patterns import PatternRetriever

PATTERNS = Path(__file__).parents[1] / "app" / "knowledge" / "patterns.json"


def metadata(session: str, motion: MotionFeatures | None = None, hour: int = 12) -> AnalyzeMetadata:
    return AnalyzeMetadata(
        device_id="device-test-123",
        session_id=session,
        sample_rate=16_000,
        motion=motion or MotionFeatures(),
        context=ContextFeatures(hour=hour),
    )


def engine() -> FusionEngine:
    return FusionEngine(PatternRetriever(PATTERNS))


def test_time_context_cannot_create_a_threat() -> None:
    result = engine().assess(metadata("night-context", hour=2), AudioInference())
    assert result.risk_level == "safe"
    assert result.needs_evidence_capture is False


def test_repeated_scream_without_independent_motion_never_auto_sos() -> None:
    fusion = engine()
    audio = AudioInference(
        distress_score=0.91,
        persistent_ratio=1,
        top_classes=[("Screaming", 0.91)],
        available=True,
    )
    first = fusion.assess(metadata("audio-only"), audio)
    second = fusion.assess(metadata("audio-only"), audio)
    assert first.risk_level == "alert"
    assert second.risk_level == "alert"
    assert not second.needs_evidence_capture


def test_media_playback_suppresses_false_positive() -> None:
    audio = AudioInference(
        distress_score=0.78,
        persistent_ratio=0.5,
        media_score=0.92,
        top_classes=[("Television", 0.92), ("Screaming", 0.78), ("Music", 0.62)],
        available=True,
        factors=["Possible media playback"],
    )
    result = engine().assess(
        metadata(
            "media-playback",
            MotionFeatures(sample_count=30, peak_acceleration_g=1.2, jerk_rms=2),
        ),
        audio,
    )
    assert result.risk_level in {"watch", "alert"}
    assert result.needs_evidence_capture is False


def test_fall_without_audio_requires_check_in_not_auto_sos() -> None:
    motion = MotionFeatures(
        sample_count=30,
        peak_acceleration_g=3.5,
        jerk_rms=22,
        free_fall_observed=True,
        impact_after_free_fall=True,
    )
    result = engine().assess(metadata("fall-only", motion), AudioInference())
    assert result.risk_level == "alert"
    assert result.needs_evidence_capture is False


def test_cross_signal_pattern_requires_confirmation_before_sos() -> None:
    fusion = engine()
    motion = MotionFeatures(
        sample_count=30,
        peak_acceleration_g=3.0,
        jerk_rms=20,
        rotation_rms=210,
    )
    audio = AudioInference(
        distress_score=0.8,
        persistent_ratio=0.8,
        top_classes=[("Screaming", 0.82), ("Shout", 0.7)],
        factors=["Audio: Screaming (82%)"],
        available=True,
    )
    first = fusion.assess(metadata("confirmed-cross", motion), audio)
    second = fusion.assess(metadata("confirmed-cross", motion), audio)
    assert first.risk_level == "alert"
    assert first.needs_evidence_capture is False
    assert second.risk_level == "sos"
    assert second.needs_evidence_capture is True


def test_exceptional_scream_and_ordered_fall_can_escalate_immediately() -> None:
    motion = MotionFeatures(
        sample_count=30,
        peak_acceleration_g=3.8,
        jerk_rms=25,
        free_fall_observed=True,
        impact_after_free_fall=True,
    )
    audio = AudioInference(
        distress_score=0.92,
        persistent_ratio=0.9,
        top_classes=[("Screaming", 0.94)],
        available=True,
    )
    result = engine().assess(metadata("exceptional-fall", motion), audio)
    assert result.risk_level == "sos"
    assert result.needs_evidence_capture is True
