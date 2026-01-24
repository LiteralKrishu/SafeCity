
import streamlit as st
import cv2
import time
import numpy as np
from PIL import Image
import base64
from io import BytesIO

from safecity_core.vision.detector import ThreatDetector
from safecity_core.audio.monitor import AudioMonitor
from safecity_streamlit.components.ui_renderer import (
    render_header, render_alert_level, render_emergency_panel,
    render_sos_countdown, render_broadcast_panel
)
from safecity_core.ai.verification import verify_visual_threat
from safecity_streamlit.components.risk_engine import RiskEngine, RiskLevel, RiskState

# Page Config
st.set_page_config(
    page_title="SafeCity AI",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize Session State
if "is_monitoring" not in st.session_state:
    st.session_state.is_monitoring = False
if "risk_state" not in st.session_state:
    st.session_state.risk_state = RiskState(level=RiskLevel.SAFE, confidence=1.0, message="System Ready")
if "last_genkit_check" not in st.session_state:
    st.session_state.last_genkit_check = time.time()
if "verification_future" not in st.session_state:
    st.session_state.verification_future = None
if "executor" not in st.session_state:
    from concurrent.futures import ThreadPoolExecutor
    st.session_state.executor = ThreadPoolExecutor(max_workers=1)

# SOS State Machine
if "sos_mode" not in st.session_state:
    st.session_state.sos_mode = "IDLE"  # IDLE, COUNTDOWN, BROADCAST
if "sos_countdown_start" not in st.session_state:
    st.session_state.sos_countdown_start = 0
if "sos_broadcast_data" not in st.session_state:
    st.session_state.sos_broadcast_data = {}
if "last_frame_b64" not in st.session_state:
    st.session_state.last_frame_b64 = ""

from safecity_streamlit.components.gyroscope import GyroscopeMonitor

# Initialize Components (Cached)
@st.cache_resource
def load_detector():
    return ThreatDetector()

@st.cache_resource
def load_audio():
    return AudioMonitor()

@st.cache_resource
def load_gyro():
    return GyroscopeMonitor()

@st.cache_resource
def load_risk_engine():
    return RiskEngine()

detector = load_detector()
audio_mon = load_audio()
gyro_mon = load_gyro()
risk_engine = load_risk_engine()

# --- Sidebar ---
st.sidebar.title("Configuration")
monitoring_toggle = st.sidebar.toggle("Activate Monitoring", value=st.session_state.is_monitoring)
st.session_state.is_monitoring = monitoring_toggle

camera_index = st.sidebar.number_input("Camera Index (0=Default, 1=External)", min_value=0, max_value=5, value=0, step=1)
st.sidebar.info("Tip: Use an external camera placed behind you for 'Sneak Attack' detection.")

# Risk Context (Real-time)
city, loc_risk = risk_engine.get_location_context()

with st.sidebar.expander("Sensor Simulation (Gyro)"):
    st.caption("Simulate accelerometer readings (G)")
    sim_x = st.slider("Acc X", -4.0, 4.0, 0.0)
    sim_y = st.slider("Acc Y", -4.0, 4.0, 1.0)
    sim_z = st.slider("Acc Z", -4.0, 4.0, 0.0)

with st.sidebar.expander("Settings"):
    user_name = st.text_input("My Name", value="Sousnigdho Das")
    emergency_contact = st.text_input("Emergency Contact", value="+91 98765 43210")
    st.checkbox("Push Notifications", value=True)

# --- Determine if we're in SOS mode ---
is_sos_active = st.session_state.sos_mode in ["COUNTDOWN", "BROADCAST"]

# --- Main UI ---
render_header(st.session_state.is_monitoring, is_sos_mode=is_sos_active)

# Status Area
status_container = st.empty()
sos_container = st.empty()
risk_dashboard = st.empty()
video_container = st.empty()

# --- SOS State Machine Handler ---
def handle_sos_state():
    """Handle SOS countdown and broadcast states."""
    current_mode = st.session_state.sos_mode
    
    if current_mode == "COUNTDOWN":
        elapsed = time.time() - st.session_state.sos_countdown_start
        remaining = max(0, 3 - int(elapsed))
        
        with sos_container.container():
            render_sos_countdown(remaining)
            
            col1, col2 = st.columns(2)
            with col1:
                if st.button("🛑 I AM SAFE - CANCEL", type="primary", use_container_width=True):
                    st.session_state.sos_mode = "IDLE"
                    st.session_state.risk_state = RiskState(
                        level=RiskLevel.SAFE, 
                        confidence=1.0, 
                        message="SOS Cancelled by User"
                    )
                    st.rerun()
            with col2:
                if st.button("🆘 SEND NOW", type="secondary", use_container_width=True):
                    st.session_state.sos_mode = "BROADCAST"
                    st.session_state.sos_broadcast_data = {
                        "location": city,
                        "threat": st.session_state.risk_state.message,
                        "triggers": ", ".join(st.session_state.risk_state.triggers),
                        "frame_b64": st.session_state.last_frame_b64,
                        "contact": emergency_contact,
                        "time": time.strftime("%Y-%m-%d %H:%M:%S")
                    }
                    st.rerun()
        
        # Auto-trigger after countdown
        if remaining <= 0:
            st.session_state.sos_mode = "BROADCAST"
            st.session_state.sos_broadcast_data = {
                "location": city,
                "threat": st.session_state.risk_state.message,
                "triggers": ", ".join(st.session_state.risk_state.triggers),
                "frame_b64": st.session_state.last_frame_b64,
                "contact": emergency_contact,
                "time": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            st.rerun()
            
    elif current_mode == "BROADCAST":
        data = st.session_state.sos_broadcast_data
        with sos_container.container():
            render_broadcast_panel(
                location=data.get("location", "Unknown"),
                threat_info=f"{data.get('threat', 'Emergency')} ({data.get('triggers', 'Unknown')})",
                frame_b64=data.get("frame_b64", ""),
                contact=data.get("contact", emergency_contact)
            )
            
            st.warning("**DEMO MODE**: In production, this data would be sent to emergency services.")
            
            if st.button("✅ I AM SAFE - End Emergency", type="primary", use_container_width=True):
                st.session_state.sos_mode = "IDLE"
                st.session_state.risk_state = RiskState(
                    level=RiskLevel.SAFE,
                    confidence=1.0,
                    message="Emergency Resolved"
                )
                st.session_state.sos_broadcast_data = {}
                st.rerun()
        
        return True  # Signal that we're in broadcast mode (skip normal loop)
    
    return False  # Continue normal processing


# --- Main Loop Logic ---
if st.session_state.is_monitoring:
    # Handle active SOS states first
    if st.session_state.sos_mode == "BROADCAST":
        handle_sos_state()
    else:
        cap = cv2.VideoCapture(camera_index)
        audio_mon.start_stream()
        
        stop_button = st.sidebar.button("Stop Stream")
        
        # Handle countdown if active
        if st.session_state.sos_mode == "COUNTDOWN":
            handle_sos_state()
        
        while st.session_state.is_monitoring and not stop_button:
            # Check if we've transitioned to broadcast during loop
            if st.session_state.sos_mode == "BROADCAST":
                break
            
            # 1. Video Processing
            ret, frame = cap.read()
            if not ret:
                st.error("Failed to access camera.")
                break
                
            result = detector.process_frame(frame)
            
            # Store frame for potential SOS broadcast
            try:
                frame_rgb = cv2.cvtColor(result.annotated_frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                buffered = BytesIO()
                pil_image.save(buffered, format="JPEG", quality=85)
                st.session_state.last_frame_b64 = base64.b64encode(buffered.getvalue()).decode()
            except Exception:
                pass
            
            # 2. Audio Processing
            audio_result = audio_mon.process_chunk_full()
            
            # 3. Gyroscope Processing (Simulated)
            is_gyro_abnormal, gyro_msg = gyro_mon.process_data(sim_x, sim_y, sim_z)

            # 4. Context Fusion (Risk Engine)
            risk_state = risk_engine.calculate_risk_state(
                video_threat_level=result.threat_level,
                is_scream=audio_result.is_scream,
                is_keyword_detected=audio_result.is_keyword_detected,
                detected_keyword=audio_result.detected_keyword,
                gyro_abnormal=is_gyro_abnormal,
                detected_action=result.detected_action
            )
            
            st.session_state.risk_state = risk_state

            # 5. Check for SOS Trigger (CRITICAL level -> Start countdown)
            if risk_state.level == RiskLevel.CRITICAL and st.session_state.sos_mode == "IDLE":
                st.session_state.sos_mode = "COUNTDOWN"
                st.session_state.sos_countdown_start = time.time()
                st.rerun()

            # 6. AI Verification
            now = time.time()
            should_verify = (risk_state.level.value >= RiskLevel.WARNING.value) and \
                            (now - st.session_state.last_genkit_check > 5) and \
                            (st.session_state.verification_future is None)

            if should_verify:
                st.toast("Verifying threat locally...", icon="🔍")
                _, encoded_img = cv2.imencode('.jpg', result.annotated_frame)
                future = st.session_state.executor.submit(verify_visual_threat, encoded_img.tobytes())
                st.session_state.verification_future = future
                st.session_state.last_genkit_check = now
                
            if st.session_state.verification_future is not None:
                if st.session_state.verification_future.done():
                    try:
                        verification = st.session_state.verification_future.result()
                        if verification['is_confirmed_threat']:
                            st.session_state.risk_state.level = RiskLevel.CRITICAL
                            st.session_state.risk_state.message = verification['description']
                            st.session_state.risk_state.triggers.append("AI Confirmed Threat")
                            
                            # Trigger SOS countdown
                            if st.session_state.sos_mode == "IDLE":
                                st.session_state.sos_mode = "COUNTDOWN"
                                st.session_state.sos_countdown_start = time.time()
                                st.rerun()
                    except Exception as e:
                        st.error(f"AI Verification Failed: {e}")
                    finally:
                        st.session_state.verification_future = None

            # 7. Render Updates
            with status_container:
                trigger_text = ", ".join(risk_state.triggers) if risk_state.triggers else "Stable"
                render_alert_level(
                    level=risk_state.level.name, 
                    message=risk_state.message, 
                    details=f"Triggers: {trigger_text}",
                    is_sos=(st.session_state.sos_mode == "COUNTDOWN")
                )
                
            # Contextual Risk Dashboard
            with risk_dashboard.container():
                c1, c2, c3, c4 = st.columns(4)
                
                vis_val = 100 if result.threat_level == "DANGER" else (50 if result.threat_level == "WARNING" else 0)
                c1.metric("Visual Threat", f"{vis_val}%", delta_color="inverse", help=f"Action: {result.detected_action}")
                
                aud_val = 100 if audio_result.is_scream or audio_result.is_keyword_detected else (50 if audio_result.volume > 500 else 0)
                aud_msg = "Scream/Keyword" if aud_val == 100 else "Noise"
                c2.metric("Audio Analysis", f"{aud_val}%", delta=aud_msg, delta_color="inverse")
                
                mot_val = 100 if is_gyro_abnormal else 0
                c3.metric("Motion Impact", f"{mot_val}%", delta_color="inverse")
                
                ctx_val = loc_risk + (20 if risk_engine._is_night_time() else 0)
                c4.metric("Context Risk", f"{ctx_val}%", help=f"City: {city}")
                
                st.progress(risk_state.confidence, text=f"System Confidence: {int(risk_state.confidence*100)}%")
                
            # Display Video
            try:
                video_container.markdown(
                    f'<img src="data:image/jpeg;base64,{st.session_state.last_frame_b64}" style="width:100%; border-radius: 10px;">',
                    unsafe_allow_html=True
                )
            except Exception:
                pass

            time.sleep(0.05)

        cap.release()
        audio_mon.stop_stream()
else:
    status_container.info("Monitoring is paused. Enable it in the sidebar to start.")
