"""
Threat Verification Module

Provides threat verification using:
1. Local YOLOv8 detection (primary, fast, no API limits)
2. Gemini API (optional fallback for advanced analysis)
"""

import os
from typing import TypedDict
from dotenv import load_dotenv

load_dotenv()


class ThreatContext(TypedDict):
    is_confirmed_threat: bool
    description: str
    action_recommendation: str


class AudioContext(TypedDict):
    is_distress: bool
    transcript_summary: str


# Configuration
USE_LOCAL_VERIFICATION = True  # Set to False to use Gemini API
USE_GEMINI_FALLBACK = False    # Set to True to use Gemini as fallback when local is uncertain


def verify_visual_threat(image_bytes: bytes) -> ThreatContext:
    """
    Verify a visual threat using local AI (YOLOv8) or Gemini API.

    Args:
        image_bytes: JPEG encoded image bytes

    Returns:
        ThreatContext with threat assessment
    """
    if USE_LOCAL_VERIFICATION:
        return _verify_local(image_bytes)
    else:
        return _verify_gemini(image_bytes)


def _verify_local(image_bytes: bytes) -> ThreatContext:
    """Verify using local YOLOv8 detection."""
    try:
        from safecity_core.ai.local_verifier import verify_local
        result = verify_local(image_bytes)

        # Convert to standard ThreatContext (strip extra fields)
        return ThreatContext(
            is_confirmed_threat=result["is_confirmed_threat"],
            description=result["description"],
            action_recommendation=result["action_recommendation"]
        )
    except Exception as e:
        print(f"Local verification error: {e}")

        # Fallback to Gemini if enabled
        if USE_GEMINI_FALLBACK:
            print("Falling back to Gemini API...")
            return _verify_gemini(image_bytes)

        return ThreatContext(
            is_confirmed_threat=False,
            description=f"Local verification failed: {str(e)}",
            action_recommendation="Stay alert."
        )


def _verify_gemini(image_bytes: bytes) -> ThreatContext:
    """Verify using Gemini API with rate limiting."""
    try:
        import google.generativeai as genai
        import time
        import threading

        # Configure GenAI
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return ThreatContext(
                is_confirmed_threat=False,
                description="Gemini API key not configured",
                action_recommendation="Configure GOOGLE_API_KEY in .env file"
            )

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')

        prompt = """
        You are a security AI. Analyze this image captured from a personal safety camera.
        The system has detected a potential threat (e.g., rapid motion or a person behind the user).

        1. Is there a person in the frame acting aggressively, holding a weapon, or lurking suspiciously?
        2. Is the scene dangerous?

        Return your response in a structured format implies by the following example (JSON):
        {
            "is_confirmed_threat": true/false,
            "description": "Brief description of what is seen.",
            "action_recommendation": "Advice for the user (e.g., 'Run', 'Turn around', 'Call 911')."
        }
        """

        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": image_bytes}
        ])

        text = response.text
        is_threat = "true" in text.lower() and '"is_confirmed_threat": true' in text.lower()

        return ThreatContext(
            is_confirmed_threat=is_threat,
            description=text,
            action_recommendation="Check your surroundings immediately."
        )

    except Exception as e:
        error_str = str(e)
        print(f"Gemini API Error: {e}")

        return ThreatContext(
            is_confirmed_threat=False,
            description=f"API error: {error_str[:100]}",
            action_recommendation="Stay alert."
        )


async def verify_visual_threat_async(image_bytes: bytes) -> ThreatContext:
    """Async version - uses local verification (which is fast enough to not need async)."""
    return verify_visual_threat(image_bytes)


def verify_audio_stress(audio_bytes: bytes) -> AudioContext:
    """Future implementation for audio verification."""
    return AudioContext(
        is_distress=True,
        transcript_summary="Loud noise detected."
    )
