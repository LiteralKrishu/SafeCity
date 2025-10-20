# 🛡️ SafeCity — AI-Powered Personal Safety Web App  
**Version:** 0.5 (Half Submission)  
**Status:** Core Features Implemented — Backend, Sensor Integration, and Alert System Prototyped

---

## 🚀 Overview

**SafeCity** is an intelligent web-based safety monitoring application designed to detect real-time distress through **audio, visual, motion, and contextual signals**.  
Using modern web technologies and AI inference models, the system provides **tiered safety alerts** that escalate automatically when signs of distress are detected.  

This half submission focuses on **core functional integration** (AI models, alert logic, and backend connectivity) with minimal UI and stable background operation.

---

## 🧩 Core Modules Implemented

### 1. **Real-Time Audio Analysis**
- Captures live microphone input using the Web Audio API.
- Runs TensorFlow.js Wav2Vec2 model for scream and panic detection.
- Operates with 3-second inference windows.
- Outputs distress probability to Alert Engine.

### 2. **Vision Distress Detection**
- Uses MediaPipe FaceMesh and BlazePose.
- Extracts facial emotion and posture indicators.
- Detects visual stress patterns (e.g., raised eyebrows, abrupt motion).
- Streams scores to the AI Alert Engine.

### 3. **Contextual Risk Assessment**
- Implements browser Geolocation API and local time awareness.
- Dynamically adjusts risk based on:
  - Time of day (higher weight at night)
  - Risk zones (configurable data source)
- Provides normalized risk score (0–1).

### 4. **AI Alert Engine**
- Fusion algorithm integrating multimodal inputs:
total_risk = (0.4 * audio) + (0.3 * vision) + (0.2 * motion) + (0.1 * context)

- Triggers alerts in progressive tiers:
- ⚠️ Level 1: User confirmation prompt (“Are you okay?”)
- ⚡ Level 2: Device vibration alert
- 🚨 Level 3: SOS message via Twilio

### 5. **Emergency Contact Integration (Twilio)**
- FastAPI backend routes triggered from frontend.
- Sends live SMS alerts containing:
- GPS coordinates
- Timestamp
- “SafeCity Alert” message
- Secure credential handling via environment variables.

### 6. **Background Operation Mode**
- Implemented as a PWA (Progressive Web App).
- Uses Service Workers and Background Sync for persistence.
- Includes a minimal “Safety Status Bar” UI.

---

## 🧠 Tech Stack

| Layer | Technology | Description |
|--------|-------------|-------------|
| **Frontend** | React + TensorFlow.js + MediaPipe | UI + AI processing |
| **Backend** | FastAPI + Twilio | Alert routing + SMS integration |
| **Hosting** | Vercel (Frontend) + Render/AWS (Backend) | Deployment |
| **Database** | PostgreSQL (Optional) | Logging alerts and metadata |
| **AI Models** | Wav2Vec2, BlazePose, FaceMesh | Multimodal inference |

---

## 🎨 UI / UX Specifications

- **Primary Color:** `#2E3B55`  
- **Background Color:** `#1A2133`  
- **Accent Color:** `#465A80`
- **Font Pairing:**
- *Space Grotesk* — Headlines
- *Inter* — Body text
- **Design Philosophy:**
- Minimal, always-on interface
- Subtle animations
- High-contrast indicators for safety state

---
## ⚙️ Installation (Local Setup)

### Prerequisites
- Node.js ≥ 18.x
- Python ≥ 3.10
- Twilio Account with API Credentials
- Secure HTTPS environment (required for sensors)

### Steps

#### 1. Clone Repository
```bash
git clone https://github.com/<your-username>/SafeCity.git
cd SafeCity
```
#### 2. Install Frontend
```bash
cd frontend
npm install
npm run dev
```
#### 3. Install Backend
```bash
cd ../backend
pip install -r requirements.txt
uvicorn main:app --reload
```
#### 4. Configure Environment Variables
Create .env file in /backend:

```env
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 🧪 Current Limitations (Half Submission)
- Emotion detection optimized for daylight; poor accuracy in low light.
- Audio model lacks multi-language distress detection.
- Background motion sensing partially implemented.
- No user account or contact management UI yet.
- Battery optimization pending for continuous monitoring.

---

## 📅 Next Phase Goals (Full Submission)
✅ Add cloud-based risk mapping dataset integration.  
✅ Implement full motion sensor fusion using gyroscope & accelerometer.  
✅ Develop user management & emergency contact dashboard.  
✅ Add cross-platform compatibility (PWA + Android WebView wrapper).  
✅ Optimize AI inference pipeline for on-device efficiency.  

---

## 🧾 License
MIT License © 2025 SafeCity Developers Team

---

## 👥 Contributors

- **AI & Vision Systems:** Sousnigdho Das
- **Backend & Infrastructure:** Sousnigdho Das
- **UI/UX Designer:** Shreeya Banerjee
- **Tester:** Pranav Sharma

**SafeCity — Empowering safety through real-time AI.**