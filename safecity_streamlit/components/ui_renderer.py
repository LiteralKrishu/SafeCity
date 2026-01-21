
import streamlit as st

def render_header(is_monitoring):
    st.markdown("""
    <style>
    .header {
        display: flex;
        justify_content: space-between;
        align_items: center;
        padding: 1rem;
        background-color: #0e1117;
        border-bottom: 1px solid #262730;
    }
    .title {
        font-size: 2rem;
        font-weight: bold;
        color: #ffffff;
    }
    .status-badge {
        padding: 0.5rem 1rem;
        border-radius: 999px;
        font-weight: bold;
    }
    .monitoring-on {
        background-color: #0cce6b20;
        color: #0cce6b;
        border: 1px solid #0cce6b;
    }
    .monitoring-off {
        background-color: #ff4b4b20;
        color: #ff4b4b;
        border: 1px solid #ff4b4b;
    }
    </style>
    """, unsafe_allow_html=True)

    status_class = "monitoring-on" if is_monitoring else "monitoring-off"
    status_text = "MONITORING ACTIVE" if is_monitoring else "MONITORING PAUSED"

    st.markdown(f"""
    <div class="header">
        <div class="title">🛡️ SafeCity</div>
        <div class="status-badge {status_class}">{status_text}</div>
    </div>
    """, unsafe_allow_html=True)

def render_alert_level(level, message, details=""):
    color_map = {
        "SAFE": "#0cce6b",
        "WARNING": "#ffa726",
        "DANGER": "#ff4b4b"
    }
    color = color_map.get(level, "#0cce6b")
    
    st.markdown(f"""
    <div style="
        background-color: {color}20;
        border: 2px solid {color};
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin-bottom: 20px;
        animation: pulse 2s infinite;
    ">
        <h2 style="color: {color}; margin: 0;">{level}</h2>
        <h3 style="color: #ffffff; margin-top: 10px;">{message}</h3>
        <p style="color: #cccccc;">{details}</p>
    </div>
    """, unsafe_allow_html=True)

def render_emergency_panel():
    st.error("### 🆘 EMERGENCY MODE ACTIVE")
    st.markdown("Your location has been shared with emergency contacts.")
    if st.button("I AM SAFE (CANCEL SOS)", type="primary"):
        return True
    return False
