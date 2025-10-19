# **App Name**: SafeCity

## Core Features:

- Real-time Audio Analysis: Continuously processes microphone input to detect distress signals such as screams or heightened emotional tone using the Wav2Vec2 model (TensorFlow.js implementation).
- Vision Distress Detection: Uses the device camera with MediaPipe FaceMesh and BlazePose to detect emotional distress or abnormal body posture in real-time.
- Contextual Risk Assessment: Integrates geolocation and system time data to compute a dynamic risk score based on user location and time-of-day context.
- AI Alert Engine: Tiered multimodal alerting system analyzing combined audio, visual, motion, and contextual cues. Escalation path: Subtle prompt -> Vibration -> Silent SOS -> Emergency alert. This feature uses a tool to determine the best course of action based on the available data.
- Emergency Contact Alert via Twilio: On confirmed or probable distress, triggers the backend to send SMS alerts (via FastAPI + Twilio) including timestamp and GPS coordinates to registered emergency contacts.
- Background Operation Mode: Persistent, lightweight background service with minimal UI footprint. Continuously monitors and processes sensor inputs with optimized resource usage.

## Style Guidelines:

- Primary Color: `#2E3B55`
Used for main UI elements and safety indicators.
- Background Color: `#1A2133`
Base background for dark theme, providing depth and contrast.
- Accent Color: `#465A80`
Highlights, active states, and buttons for visual clarity against the dark interface.
- Font Pairing:
- Headings: *Space Grotesk* (sans-serif)
- Body Text: *Inter* (sans-serif)
Maintain balanced weights; bold headlines, medium-weight body.
- Simple, geometric icons representing safety status, alert levels, and sensor states.
Designed for clarity at a glance on mobile and desktop.
- Layout & Interaction:
- Minimalist single-page interface.
- Persistent status bar for system activity and alert indicators.
- Subtle transitions and animations for alert changes (fade, pulse).
- Focus on accessibility and legibility in low-light environments.
- Subtle transitions and animations for alert changes (fade, pulse).