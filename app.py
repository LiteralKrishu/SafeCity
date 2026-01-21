
import streamlit as st
import cv2
import time
import numpy as np
from PIL import Image
import base64
from io import BytesIO

from safecity_core.vision.detector import ThreatDetector
from safecity_core.audio.monitor import AudioMonitor
from safecity_streamlit.components.ui_renderer import render_header, render_alert_level, render_emergency_panel
from safecity_core.ai.verification import verify_visual_threat

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
if "alert_level" not in st.session_state:
    st.session_state.alert_level = "SAFE"
if "threat_message" not in st.session_state:
    st.session_state.threat_message = "System Normal"
if "last_genkit_check" not in st.session_state:
    st.session_state.last_genkit_check = time.time()  # Prevent immediate API call on startup
if "verification_future" not in st.session_state:
    st.session_state.verification_future = None
if "executor" not in st.session_state:
    from concurrent.futures import ThreadPoolExecutor
    st.session_state.executor = ThreadPoolExecutor(max_workers=1)

from safecity_streamlit.components.gyroscope import GyroscopeMonitor
from safecity_core.analysis.risk import RiskEngine

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
    sim_y = st.slider("Acc Y", -4.0, 4.0, 1.0) # 1G gravity normally
    sim_z = st.slider("Acc Z", -4.0, 4.0, 0.0)

with st.sidebar.expander("Settings"):
    st.text_input("My Name", value="User")
    st.text_input("Emergency Contact", value="+1 (555) 123-4567")
    st.checkbox("Push Notifications", value=True)

# --- Main UI ---
render_header(st.session_state.is_monitoring)

# Status Area
status_container = st.empty()
risk_dashboard = st.empty()  # Use empty() to replace content each frame
video_container = st.empty()

# Emergency Reset
if st.session_state.alert_level == "SOS" or st.session_state.alert_level == "DANGER":
    if render_emergency_panel():
        st.session_state.alert_level = "SAFE"
        st.session_state.threat_message = "Alert Cancelled"
        st.rerun()

# --- Main Loop Logic ---
if st.session_state.is_monitoring:
    cap = cv2.VideoCapture(camera_index)
    audio_mon.start_stream()
    
    stop_button = st.sidebar.button("Stop Stream")
    
    while st.session_state.is_monitoring and not stop_button:
        # 1. Video Processing
        ret, frame = cap.read()
        if not ret:
            st.error("Failed to access camera.")
            break
            
        result = detector.process_frame(frame)
        
        # 2. Audio Processing (Non-blocking)
        is_scream, volume = audio_mon.process_chunk()
        
        # 3. Gyroscope Processing (Simulated)
        is_gyro_abnormal, gyro_msg = gyro_mon.process_data(sim_x, sim_y, sim_z)

        # 4. Context Fusion (Risk Engine)
        total_risk_score, risk_breakdown = risk_engine.calculate_aggregate_risk(
            result.threat_level, 
            is_scream, 
            is_gyro_abnormal
        )

        # 5. Threat Logic & State Update
        current_threat_level = result.threat_level
        msg_override = result.message
        
        # Force escalation if Total Risk is extreme (>80) regardless of single sensor
        if total_risk_score > 80:
             current_threat_level = "DANGER"
             msg_override = "CRITICAL RISK LEVEL"

        # Escalate on Scream
        if is_scream:
            current_threat_level = "DANGER"
            msg_override = "SCREAM DETECTED!"
            
        # Escalate on Gyro Impact
        if is_gyro_abnormal:
            current_threat_level = "DANGER"
            msg_override = gyro_msg


        # Trigger AI Verification (Local YOLOv8 - fast, no rate limits)
        # Reduced interval since local detection is fast
        now = time.time()
        should_verify = (current_threat_level == "DANGER") and \
                        (now - st.session_state.last_genkit_check > 5) and \
                        (st.session_state.verification_future is None)

        if should_verify:
            st.toast("Verifying threat locally...", icon="🔍")
            _, encoded_img = cv2.imencode('.jpg', result.annotated_frame)
            
            # Submit to background thread
            future = st.session_state.executor.submit(verify_visual_threat, encoded_img.tobytes())
            st.session_state.verification_future = future
            st.session_state.last_genkit_check = now
            
        # Check for results
        if st.session_state.verification_future is not None:
            if st.session_state.verification_future.done():
                try:
                    verification = st.session_state.verification_future.result()
                    if verification['is_confirmed_threat']:
                        st.session_state.alert_level = "DANGER"
                        st.session_state.threat_message = verification['description']
                except Exception as e:
                    st.error(f"AI Verification Failed: {e}")
                finally:
                    st.session_state.verification_future = None
            else:
                # Optional: Show spinner or status that AI is processing
                pass

        
        # Update Session State Logic
        # (Prioritize keeping DANGER active)
        if current_threat_level == "DANGER":
             st.session_state.alert_level = "DANGER"
             st.session_state.threat_message = msg_override
        elif current_threat_level == "WARNING" and st.session_state.alert_level != "DANGER":
             st.session_state.alert_level = "WARNING"
             st.session_state.threat_message = msg_override
        elif current_threat_level == "SAFE" and st.session_state.alert_level not in ["SOS", "DANGER"]:
             # Cool down
             if time.time() - st.session_state.last_genkit_check > 10:
                 st.session_state.alert_level = "SAFE"
                 st.session_state.threat_message = f"Monitored: {city}"

        # 6. Render Updates
        with status_container:
            render_alert_level(st.session_state.alert_level, st.session_state.threat_message, details=f"Aggregate Risk Score: {total_risk_score}/100")
            
        # Contextual Risk Dashboard
        with risk_dashboard.container():
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Location Heat", f"{risk_breakdown['Location Context']}%", delta_color="inverse", help="Based on Local Crime Index")
            c2.metric("Visual Threat", f"{risk_breakdown['Visual Threat']}%", delta_color="inverse")
            c3.metric("Audio Panic", f"{risk_breakdown['Audio Analysis']}%", delta_color="inverse")
            c4.metric("Motion Impact", f"{risk_breakdown['Motion/Impact']}%", delta_color="inverse")
            st.progress(total_risk_score / 100, text="Total Contextual Risk Load")
            
        # Display Video (using base64 to bypass media storage issues)
        try:
            frame_rgb = cv2.cvtColor(result.annotated_frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            buffered = BytesIO()
            pil_image.save(buffered, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buffered.getvalue()).decode()
            video_container.markdown(
                f'<img src="data:image/jpeg;base64,{img_b64}" style="width:100%;">',
                unsafe_allow_html=True
            )
        except Exception as e:
            pass  # Skip frame on display error

        time.sleep(0.05)  # Slower refresh for stability

    cap.release()
    audio_mon.stop_stream()
else:
    status_container.info("Monitoring is paused. Enable it in the sidebar to start.")


