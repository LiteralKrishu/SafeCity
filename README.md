# 🛡️ SafeCity — Real-Time Personal Safety Ecosystem

**SafeCity** is a state-of-the-art, real-time personal safety monitoring system. It leverages a modern sensory architecture to provide instantaneous threat detection and automated emergency response across mobile and web platforms.

---

## 🚀 System Overview

SafeCity operates on two primary layers of intelligence:

1.  **⚡ Local Fast Intelligence**: OpenCV and MediaPipe provide low-latency (<50ms) detection of poses and movement patterns (e.g., "Sneak Attacks").
2.  **🔊 Sensory Awareness**: Real-time FFT signal processing and TFLite models (YAMNet) monitor for screams, distress keywords, and environmental risks.

---

## ✨ Key Features

### 📱 Kivy Mobile Application
- **Premium UI**: Modern, dark-themed design using Material Design Icons (MDI).
- **Interactive Metrics**: Live tracking of Visual Threat, Audio Analysis, Motion Impact, and Contextual Risk.
- **Smart SOS**: A fail-safe 3-second countdown mechanism with immediate broadcast capabilities.
- **Voice Trigger**: Background voice monitoring for distress keywords even when the app is minimized.

### 🌐 Streamlit Web Dashboard
- **Live Monitoring Station**: Real-time video and audio stream analysis from any connected device.
- **Risk Dashboard**: Comprehensive visualization of risk factors and system confidence levels.
- **Emergency Management**: Remote cancellation or escalation of SOS alerts.

### 🧠 Advanced Logic
- **State-Based Risk Engine**: A deterministic engine that fuses data from vision, audio, motion (gyro), and location to assess risk.
- **Time-Independent Assessment**: Risk assessment logic focuses on immediate sensory data, ignoring bias from time-of-day while preserving it for logging.
- **Cloud Connectivity**: Automatic incident logging to Firebase/Firestore for high-severity threats.

---

## 🛠️ Technology Stack

| Component               | Technology                   | Description                                               |
| :---------------------- | :--------------------------- | :-------------------------------------------------------- |
| **Mobile UI**           | **Kivy / KivyMD**            | Unified Python framework for cross-platform mobile apps.  |
| **Web UI**              | **Streamlit**                | Fast, interactive web dashboard for monitoring.           |
| **Vision Intelligence** | **OpenCV / MediaPipe**       | Real-time pose landmarking and action recognition.        |
| **Audio Intelligence**  | **PyAudio / NumPy / YAMNet** | Signal processing and classification for distress sounds. |
| **Backend**             | **Firebase**                 | Real-time database and secure incident logging.           |

---

## 📂 Project Structure

```text
SafeCity/
├── main.py                 # Kivy App entry point (Mobile)
├── app.py                  # Streamlit App entry point (Web)
├── safecity_core/          # Platform-agnostic core logic
│   ├── vision/             # Pose detection and action recognizers
│   ├── audio/              # Microphone monitoring and classification
│   ├── analysis/           # Risk assessment engine
├── safecity_kivy/          # Kivy-specific UI and modules
│   ├── resources/          # Font & icon assets
│   └── modules/            # Kivy hardware wrappers (Camera, Sensors)
├── safecity_streamlit/     # Streamlit-specific components
└── tests/                  # Integrity and logic tests
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.11+
- Webcam and Microphone access

### 1. Installation via Poetry (Recommended)
```powershell
# Install Poetry if you don't have it
pip install poetry

# Install dependencies
poetry install
```

### 2. Running the Apps
- **To start the Mobile (Kivy) Experience:**
  ```powershell
  poetry run python main.py
  ```
- **To start the Web (Streamlit) Dashboard:**
  ```powershell
  poetry run streamlit run app.py
  ```

---

## 🚨 Risk Assessment Logic

The **SafeCity Risk Engine** uses a priority-based state machine:
- **CRITICAL**: Immediate triggers like screams, distress keywords ("Help!", "Police!"), or dangerous actions detected by vision.
- **WARNING**: Abnormal motion or unconfirmed visual movement.
- **WATCH_MODE**: Location-based risk (high crime zone).
- **SAFE**: Standard baseline.

> [!NOTE]
> Recent updates have decoupled the **Time Factor** from the risk score to ensure un-biased assessment, though timestamps remain integral to the SOS broadcast metadata.

---

## 👥 Authors & Contributors
- **Sousnigdho Das**: System Architecture, Development Lead.
- **SafeCity Team**: Contributing developers and security researchers.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.