
import streamlit as st
import time

def render_header(is_monitoring, is_sos_mode=False):
    """Render the main header with optional SOS flashing."""
    
    # Base styles
    sos_flash = """
    @keyframes sos-flash {
        0%, 50% { background-color: #ff0000; }
        51%, 100% { background-color: #0e1117; }
    }
    .sos-active {
        animation: sos-flash 0.5s infinite !important;
    }
    .sos-border {
        animation: sos-flash 0.5s infinite !important;
        border: 5px solid #ff0000 !important;
    }
    """ if is_sos_mode else ""
    
    st.markdown(f"""
    <style>
    {sos_flash}
    .header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background-color: #0e1117;
        border-bottom: 1px solid #262730;
    }}
    .title {{
        font-size: 2rem;
        font-weight: bold;
        color: #ffffff;
    }}
    .status-badge {{
        padding: 0.5rem 1rem;
        border-radius: 999px;
        font-weight: bold;
    }}
    .monitoring-on {{
        background-color: #0cce6b20;
        color: #0cce6b;
        border: 1px solid #0cce6b;
    }}
    .monitoring-off {{
        background-color: #ff4b4b20;
        color: #ff4b4b;
        border: 1px solid #ff4b4b;
    }}
    .sos-badge {{
        background-color: #ff0000;
        color: #ffffff;
        border: 2px solid #ff0000;
        animation: sos-flash 0.5s infinite;
    }}
    </style>
    """, unsafe_allow_html=True)

    if is_sos_mode:
        status_class = "sos-badge"
        status_text = "🆘 SOS ACTIVE"
    elif is_monitoring:
        status_class = "monitoring-on"
        status_text = "MONITORING ACTIVE"
    else:
        status_class = "monitoring-off"
        status_text = "MONITORING PAUSED"

    header_class = "header sos-active" if is_sos_mode else "header"

    st.markdown(f"""
    <div class="{header_class}">
        <div class="title">🛡️ SafeCity</div>
        <div class="status-badge {status_class}">{status_text}</div>
    </div>
    """, unsafe_allow_html=True)


def render_alert_level(level, message, details="", is_sos=False):
    """Render threat level alert with optional SOS flashing."""
    color_map = {
        "SAFE": "#0cce6b",
        "WATCH_MODE": "#00b4d8",
        "WARNING": "#ffa726",
        "DANGER": "#ff4b4b",
        "CRITICAL": "#ff0000"
    }
    color = color_map.get(level, "#0cce6b")
    
    # Add flash animation for SOS
    animation = "animation: sos-flash 0.5s infinite;" if is_sos else "animation: pulse 2s infinite;"
    border_style = f"border: 5px solid {color};" if is_sos else f"border: 2px solid {color};"
    
    st.markdown(f"""
    <style>
    @keyframes sos-flash {{
        0%, 50% {{ background-color: #ff000080; border-color: #ffffff; }}
        51%, 100% {{ background-color: #ff000020; border-color: #ff0000; }}
    }}
    @keyframes pulse {{
        0%, 100% {{ opacity: 1; }}
        50% {{ opacity: 0.7; }}
    }}
    </style>
    <div style="
        background-color: {color}20;
        {border_style}
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin-bottom: 20px;
        {animation}
    ">
        <h2 style="color: {color}; margin: 0;">{'🆘 ' + level if is_sos else level}</h2>
        <h3 style="color: #ffffff; margin-top: 10px;">{message}</h3>
        <p style="color: #cccccc;">{details}</p>
    </div>
    """, unsafe_allow_html=True)


def render_sos_countdown(seconds_remaining: int):
    """Render SOS countdown confirmation popup."""
    st.markdown(f"""
    <style>
    @keyframes countdown-pulse {{
        0%, 100% {{ transform: scale(1); }}
        50% {{ transform: scale(1.1); }}
    }}
    .countdown-container {{
        background: linear-gradient(135deg, #ff0000, #cc0000);
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        margin: 20px 0;
        box-shadow: 0 10px 40px rgba(255, 0, 0, 0.5);
    }}
    .countdown-number {{
        font-size: 120px;
        font-weight: bold;
        color: white;
        animation: countdown-pulse 1s infinite;
        text-shadow: 0 5px 20px rgba(0,0,0,0.3);
    }}
    .countdown-text {{
        font-size: 24px;
        color: white;
        margin-top: 20px;
    }}
    </style>
    <div class="countdown-container">
        <div class="countdown-number">{seconds_remaining}</div>
        <div class="countdown-text">⚠️ EMERGENCY BROADCAST IN {seconds_remaining} SECONDS</div>
        <div style="color: #ffcccc; margin-top: 10px;">Press "I AM SAFE" to cancel</div>
    </div>
    """, unsafe_allow_html=True)


def render_broadcast_panel(location: str, threat_info: str, frame_b64: str, contact: str = "+1 (555) 123-4567"):
    """Render the demo broadcast panel showing what would be sent to emergency contacts."""
    st.markdown("""
    <style>
    .broadcast-container {
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 3px solid #ff0000;
        border-radius: 15px;
        padding: 25px;
        margin: 20px 0;
        box-shadow: 0 10px 40px rgba(255, 0, 0, 0.3);
    }
    .broadcast-header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid #ff000050;
    }
    .broadcast-title {
        color: #ff0000;
        font-size: 24px;
        font-weight: bold;
    }
    .broadcast-badge {
        background: #ff0000;
        color: white;
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 12px;
        animation: blink 1s infinite;
    }
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0.5; }
    }
    .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 20px;
    }
    .info-card {
        background: #ffffff10;
        border-radius: 10px;
        padding: 15px;
    }
    .info-label {
        color: #888;
        font-size: 12px;
        text-transform: uppercase;
        margin-bottom: 5px;
    }
    .info-value {
        color: #ffffff;
        font-size: 16px;
        font-weight: bold;
    }
    .video-frame {
        border-radius: 10px;
        border: 2px solid #ff000050;
        width: 100%;
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.markdown(f"""
    <div class="broadcast-container">
        <div class="broadcast-header">
            <span class="broadcast-title">📡 EMERGENCY BROADCAST SENT</span>
            <span class="broadcast-badge">LIVE</span>
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <div class="info-label">📍 Location</div>
                <div class="info-value">{location}</div>
            </div>
            <div class="info-card">
                <div class="info-label">📞 Emergency Contact</div>
                <div class="info-value">{contact}</div>
            </div>
            <div class="info-card">
                <div class="info-label">⚠️ Threat Detected</div>
                <div class="info-value">{threat_info}</div>
            </div>
            <div class="info-card">
                <div class="info-label">🕐 Broadcast Time</div>
                <div class="info-value">{time.strftime('%H:%M:%S')}</div>
            </div>
        </div>
        
        <div class="info-label" style="margin-bottom: 10px;">📹 Live Video Feed (Sent to Emergency Services)</div>
        <img src="data:image/jpeg;base64,{frame_b64}" class="video-frame" alt="Emergency Video Feed"/>
    </div>
    """, unsafe_allow_html=True)


def render_emergency_panel():
    """Render the emergency cancellation panel."""
    st.error("### 🆘 EMERGENCY MODE ACTIVE")
    st.markdown("Your location has been shared with emergency contacts.")
    if st.button("I AM SAFE (CANCEL SOS)", type="primary", use_container_width=True):
        return True
    return False
