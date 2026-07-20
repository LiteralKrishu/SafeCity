from pathlib import Path

from app.core.schemas import ContextFeatures, MotionFeatures
from app.detection.audio import AudioInference
from app.detection.patterns import PatternRetriever

PATTERNS = Path(__file__).parents[1] / "app" / "knowledge" / "patterns.json"


def test_retrieves_media_suppressor_for_playback_like_audio() -> None:
    retriever = PatternRetriever(PATTERNS)
    audio = AudioInference(
        distress_score=0.62,
        media_score=0.82,
        top_classes=[("Television", 0.82), ("Screaming", 0.58), ("Music", 0.5)],
        available=True,
    )
    matches = retriever.retrieve(
        audio,
        MotionFeatures(sample_count=20, peak_acceleration_g=1.1),
        motion_score=0.0,
        context=ContextFeatures(),
    )
    assert any(match.pattern.id == "media-playback" for match in matches)


def test_retrieves_ordered_fall_pattern_not_generic_drop() -> None:
    retriever = PatternRetriever(PATTERNS)
    motion = MotionFeatures(
        sample_count=30,
        peak_acceleration_g=3.4,
        jerk_rms=18,
        free_fall_observed=True,
        impact_after_free_fall=True,
    )
    matches = retriever.retrieve(
        AudioInference(), motion, motion_score=0.97, context=ContextFeatures()
    )
    ids = [match.pattern.id for match in matches]
    assert "fall-sequence" in ids
    assert ids.index("fall-sequence") < ids.index("device-drop") if "device-drop" in ids else True

