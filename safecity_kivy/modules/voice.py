"""
Voice Trigger with Keyword Detection

Listens for distress keywords using SpeechRecognition.
Compatible with the AudioMonitor keyword detection in Streamlit.
"""

import speech_recognition as sr
import threading
from typing import Callable, Optional, List
from dataclasses import dataclass


@dataclass
class VoiceResult:
    """Result from voice detection."""
    is_keyword_detected: bool
    detected_keyword: Optional[str]
    full_text: str


class VoiceTrigger:
    """
    Background voice command detection using SpeechRecognition.
    Listens for distress keywords and triggers callbacks.
    """
    
    # Same keywords as Streamlit AudioMonitor
    DISTRESS_KEYWORDS = [
        "help", "stop", "police", "call 911", "save me",
        "danger", "emergency", "attack", "fire", "run"
    ]
    
    def __init__(self, keywords: Optional[List[str]] = None):
        self.recognizer = sr.Recognizer()
        self.is_listening = False
        self.keywords = keywords or self.DISTRESS_KEYWORDS
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._callback: Optional[Callable[[VoiceResult], None]] = None
        
        # Last detection result
        self.last_result: Optional[VoiceResult] = None
        
    def start_listening(self, callback: Callable[[VoiceResult], None]):
        """
        Start background listening for voice commands.
        
        Args:
            callback: Function to call when a keyword is detected.
                     Receives VoiceResult with detection info.
        """
        if self.is_listening:
            return
            
        self.is_listening = True
        self._callback = callback
        self._stop_event.clear()
        
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        
    def _listen_loop(self):
        """Background listening loop."""
        try:
            with sr.Microphone() as source:
                # Adjust for ambient noise once
                try:
                    self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                except Exception:
                    pass
                
                while not self._stop_event.is_set() and self.is_listening:
                    try:
                        # Listen for short phrases
                        audio = self.recognizer.listen(
                            source, 
                            timeout=2, 
                            phrase_time_limit=3
                        )
                        
                        # Try to recognize speech
                        try:
                            text = self.recognizer.recognize_google(audio).lower()
                            
                            # Check for distress keywords
                            detected_keyword = None
                            for keyword in self.keywords:
                                if keyword in text:
                                    detected_keyword = keyword
                                    break
                            
                            result = VoiceResult(
                                is_keyword_detected=(detected_keyword is not None),
                                detected_keyword=detected_keyword,
                                full_text=text
                            )
                            
                            self.last_result = result
                            
                            if result.is_keyword_detected and self._callback:
                                self._callback(result)
                                
                        except sr.UnknownValueError:
                            # Speech not understood
                            pass
                        except sr.RequestError as e:
                            print(f"Speech recognition API error: {e}")
                            
                    except sr.WaitTimeoutError:
                        # No speech detected in timeout period
                        pass
                    except Exception as e:
                        if not self._stop_event.is_set():
                            print(f"Voice detection error: {e}")
                            
        except Exception as e:
            print(f"Failed to access microphone: {e}")
            self.is_listening = False
                
    def stop(self):
        """Stop listening for voice commands."""
        self.is_listening = False
        self._stop_event.set()
        
        if self._thread:
            self._thread.join(timeout=1.0)
            self._thread = None
            
    def get_last_result(self) -> Optional[VoiceResult]:
        """Get the last detection result and clear it."""
        result = self.last_result
        self.last_result = None
        return result
