
import base64
from typing import TypedDict
import genkit
from genkit.core.typing import GenerateRequest
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

# Configure GenAI directly since python Genkit SDK is in early preview
# we will use the google-generativeai library for stability in this script, 
# mimicking the structure of a Genkit flow.
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel('gemini-1.5-flash')

class ThreatContext(TypedDict):
    is_confirmed_threat: bool
    description: str
    action_recommendation: str

class AudioContext(TypedDict):
    is_distress: bool
    transcript_summary: str

def verify_visual_threat(image_bytes: bytes) -> ThreatContext:
    try:
        # Convert bytes to PIL Image or pass directly if supported
        # Gemini supports passing image data directly
        
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
        
        # Simple parsing (in production, use structured output mode)
        text = response.text
        # For robustness, we default to False if parsing fails, but here is a simple heuristic
        is_threat = "true" in text.lower() and '"is_confirmed_threat": true' in text.lower()
        
        return {
            "is_confirmed_threat": is_threat,
            "description": text, # Raw response for now to ensure we get data
            "action_recommendation": "Check your surroundings immediately."
        }
    except Exception as e:
        print(f"GenAI Error: {e}")
        return {"is_confirmed_threat": False, "description": "Error verifying threat.", "action_recommendation": "Stay alert."}

def verify_audio_stress(audio_bytes: bytes) -> AudioContext:
    # Future implementation: Upload audio blob to Gemini 1.5 Pro (which supports audio)
    # For now, we simulate safe/unsafe based on local trigger, as latency for audio upload is high.
    return {"is_distress": True, "transcript_summary": "Loud noise detected."}
