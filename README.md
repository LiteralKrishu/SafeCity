# 🛡️ SafeCity — AI-Powered Personal Safety App
**Version:** 1.0 (Streamlit Migration)
**Status:** Hybrid AI Implemented (OpenCV + Genkit)

---

## 🚀 Overview

**SafeCity** is a real-time safety monitoring application designed to detect distress through **hybrid AI**.
It uses **local computer vision (OpenCV)** for instant threat detection (latency < 50ms) and **Genkit (Gemini)** for cognitive verification of threats.

### Key Features
- **⚡ Fast "Sneak Attack" Detection**: Uses MediaPipe to detect if someone is approaching you from behind (requires back-facing camera).
- **🗣️ Audio Scream Analytics**: Instantly detects high-pitched screams using FFT signal processing.
- **🧠 AI Verification**: When a threat is detected, the frame is analyzed by Gemini 1.5 Flash to verify if it's a genuine emergency (e.g., weapon detection).
- **📍 Contextual Risk**: Adjusts alert sensitivity based on time of day (Night Mode).

---

## 🛠️ Tech Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Frontend/UI** | **Streamlit** (Python) | Interactive Dashboard & Stats |
| **Fast Vision** | **OpenCV + MediaPipe** | Real-time Motion & Pose Detection |
| **Fast Audio** | **PyAudio + NumPy** | Scream & Loud Noise Detection |
| **Cognitive AI** | **Genkit (Gemini 1.5)** | Text/Image Contextual Analysis |
| **Infra** | Local Python Runtime | Privacy-first (Local processing) |

---

## ⚙️ Installation

### Prerequisites
- Python 3.11+ (required for scipy and other dependencies)
- Webcam / Microphone
- Google Generative AI API Key
- [Poetry](https://python-poetry.org/) (recommended) or pip

---

### Option 1: Install with Poetry (Recommended)

Poetry provides better dependency management, virtual environment handling, and reproducible builds.

#### Step 1: Install Poetry

**Windows (PowerShell):**
```powershell
pip install poetry
```

**macOS / Linux:**
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

#### Step 2: Clone Repository
```bash
git clone https://github.com/<your-username>/SafeCity.git
cd SafeCity
```

#### Step 3: Configure Poetry (Optional)
To create the virtual environment inside the project directory:
```bash
poetry config virtualenvs.in-project true
```

#### Step 4: Install Dependencies
```bash
poetry install
```
This will:
- Create a `.venv` virtual environment in the project root
- Install all dependencies from `pyproject.toml`
- Lock versions in `poetry.lock` for reproducibility

#### Step 5: Setup Environment Variables
Create a `.env` file in the project root:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

#### Step 6: Run the Application
```bash
poetry run streamlit run app.py
```

---

### Option 2: Install with pip

#### Step 1: Clone Repository
```bash
git clone https://github.com/<your-username>/SafeCity.git
cd SafeCity
```

#### Step 2: Create Virtual Environment
```bash
python -m venv .venv

# Activate on Windows
.venv\Scripts\activate

# Activate on macOS/Linux
source .venv/bin/activate
```

#### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

#### Step 4: Setup Environment Variables
Create a `.env` file in the project root:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

#### Step 5: Run the Application
```bash
streamlit run app.py
```

---

## 🎯 Usage with Poetry

### Running the Application

**Run Streamlit App:**
```bash
poetry run streamlit run app.py
```

**Run Kivy App (if available):**
```bash
poetry run python main.py
```

**Run any Python script:**
```bash
poetry run python <script_name>.py
```

### Activating the Virtual Environment

If you prefer to activate the environment and run commands directly:

**Windows:**
```powershell
.venv\Scripts\activate
streamlit run app.py
```

**macOS / Linux:**
```bash
source .venv/bin/activate
streamlit run app.py
```

### Managing Dependencies

**Add a new package:**
```bash
poetry add <package-name>

# Add as dev dependency
poetry add --group dev <package-name>
```

**Remove a package:**
```bash
poetry remove <package-name>
```

**Update all dependencies:**
```bash
poetry update
```

**Update a specific package:**
```bash
poetry update <package-name>
```

**Show installed packages:**
```bash
poetry show
```

**Export to requirements.txt (for compatibility):**
```bash
poetry export -f requirements.txt --output requirements.txt
```

### Environment Information

**Show environment info:**
```bash
poetry env info
```

**Show Python path:**
```bash
poetry env info --path
```

---

## 🚨 How "Sneak Attack" Works
1.  **Setup**: Place the laptop/camera facing *behind* you.
2.  **Detection**: The system tracks human poses. If a person is centered and their shoulder width significantly increases (looming effect over 1 second), it triggers a **DANGER** alert.
3.  **Reflex**: The screen flashes RED and shows a warning "THREAT BEHIND YOU!".

---

## 🔧 Troubleshooting

### Poetry Issues

**Poetry command not found:**
If Poetry is installed but not found, add it to your PATH or use the full path:
```bash
# Windows
%APPDATA%\Python\Python313\Scripts\poetry.exe install

# Or reinstall Poetry
pip install poetry
```

**Dependency resolution fails:**
```bash
# Clear Poetry cache and retry
poetry cache clear pypi --all
poetry lock --no-update
poetry install
```

**Virtual environment not in project:**
```bash
# Configure Poetry to create .venv in project root
poetry config virtualenvs.in-project true

# Remove existing venv and reinstall
poetry env remove python
poetry install
```

### Common Errors

**PyAudio installation fails (Windows):**
```bash
# Install using pipwin
pip install pipwin
pipwin install pyaudio
```

**MediaPipe not working:**
Ensure you have a compatible Python version (3.8-3.11 recommended for MediaPipe).

**Camera/Microphone access denied:**
- Windows: Check Settings > Privacy > Camera/Microphone
- macOS: System Preferences > Security & Privacy > Camera/Microphone

---

## 📁 Project Structure

```
SafeCity/
├── .venv/                  # Virtual environment (created by Poetry)
├── pyproject.toml          # Poetry configuration & dependencies
├── poetry.lock             # Locked dependency versions
├── requirements.txt        # Pip requirements (for compatibility)
├── .env                    # Environment variables (create this)
├── app.py                  # Streamlit app entry point
├── main.py                 # Kivy app entry point
├── safecity_core/          # Core detection modules
│   ├── vision/             # Computer vision (OpenCV, MediaPipe)
│   ├── audio/              # Audio processing (PyAudio, FFT)
│   ├── analysis/           # Risk assessment engine
│   └── ai/                 # AI verification (Gemini)
├── safecity_streamlit/     # Streamlit UI components
├── safecity_kivy/          # Kivy mobile UI components
└── tests/                  # Test files
```

---

## 👥 Authors
- **Architecture & AI**: Sousnigdho Das