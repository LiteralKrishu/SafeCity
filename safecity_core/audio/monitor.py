"""
Audio Monitoring with Scream Detection and Keyword Recognition

This module provides:
- FFT-based scream detection (high-frequency audio)
- Speech recognition for distress keywords (help, stop, police, etc.)
"""

import pyaudio
import numpy as np
import scipy.fftpack
import speech_recognition as sr
from typing import Tuple, Optional
import threading
import queue
from dataclasses import dataclass


@dataclass
class AudioAnalysisResult:
    """Result of audio analysis."""
    is_scream: bool
    is_keyword_detected: bool
    detected_keyword: Optional[str]
    volume: float


class AudioMonitor:
    """
    Audio monitor with scream detection and keyword recognition.
    """
    
    # Distress keywords to listen for
    DISTRESS_KEYWORDS = [
        "help", "stop", "police", "call 911", "save me", 
        "danger", "emergency", "attack", "fire", "run"
    ]
    
    def __init__(self):
        self.CHUNK = 1024
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 44100
        self.p = pyaudio.PyAudio()
        self.stream = None
        self.is_listening = False
        
        # Detection Thresholds
        from safecity_core.config import config
        self.VOLUME_THRESHOLD = config.audio.get("volume_threshold", 500)
        self.SCREAM_FREQ_MIN = config.audio.get("scream_freq_min", 2000)
        self.SCREAM_FREQ_MAX = config.audio.get("scream_freq_max", 5000)
        
        # Speech recognition
        self.recognizer = sr.Recognizer()
        self.speech_buffer = queue.Queue()
        self.keyword_detected: Optional[str] = None
        self.keyword_lock = threading.Lock()
        
        # Background speech recognition thread
        self._speech_thread: Optional[threading.Thread] = None
        self._stop_speech_thread = threading.Event()
        
    def start_stream(self):
        """Start the audio stream and speech recognition thread."""
        if self.stream is None:
            try:
                self.stream = self.p.open(
                    format=self.FORMAT,
                    channels=self.CHANNELS,
                    rate=self.RATE,
                    input=True,
                    frames_per_buffer=self.CHUNK
                )
                self.is_listening = True
                
                # Start speech recognition in background
                self._stop_speech_thread.clear()
                self._speech_thread = threading.Thread(
                    target=self._speech_recognition_worker,
                    daemon=True
                )
                self._speech_thread.start()
                
            except Exception as e:
                print(f"Error opening audio stream: {e}")
                self.is_listening = False

    def stop_stream(self):
        """Stop the audio stream and speech recognition thread."""
        self._stop_speech_thread.set()
        if self._speech_thread:
            self._speech_thread.join(timeout=1.0)
            self._speech_thread = None
            
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        self.is_listening = False

    def _speech_recognition_worker(self):
        """Background worker for speech recognition."""
        with sr.Microphone() as source:
            # Adjust for ambient noise once
            try:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
            except Exception:
                pass
            
            while not self._stop_speech_thread.is_set():
                try:
                    # Listen for short phrases
                    audio = self.recognizer.listen(source, timeout=2, phrase_time_limit=3)
                    
                    # Try to recognize speech
                    try:
                        text = self.recognizer.recognize_google(audio).lower()
                        
                        # Check for distress keywords
                        for keyword in self.DISTRESS_KEYWORDS:
                            if keyword in text:
                                with self.keyword_lock:
                                    self.keyword_detected = keyword
                                break
                                
                    except sr.UnknownValueError:
                        # Speech not understood
                        pass
                    except sr.RequestError as e:
                        print(f"Speech recognition API error: {e}")
                        
                except sr.WaitTimeoutError:
                    # No speech detected in timeout period
                    pass
                except Exception as e:
                    if not self._stop_speech_thread.is_set():
                        print(f"Speech recognition error: {e}")

    def process_chunk(self) -> Tuple[bool, float]:
        """
        Process audio chunk for scream detection.
        
        Returns:
            Tuple of (is_scream, volume)
        """
        if not self.is_listening or self.stream is None:
            return False, 0

        try:
            data = self.stream.read(self.CHUNK, exception_on_overflow=False)
            audio_data = np.frombuffer(data, dtype=np.int16)
            
            # 1. Volume Check
            volume = np.max(np.abs(audio_data))
            if volume < self.VOLUME_THRESHOLD:
                return False, volume
                
            # 2. FFT for Pitch Detection
            fft_spectrum = scipy.fftpack.fft(audio_data)
            freqs = scipy.fftpack.fftfreq(len(fft_spectrum)) * self.RATE
            
            # Filter positive frequencies
            pos_mask = freqs > 0
            freqs = freqs[pos_mask]
            fft_spectrum = abs(fft_spectrum[pos_mask])
            
            # Find dominant frequency
            peak_freq = freqs[np.argmax(fft_spectrum)]
            
            # Check if dominant frequency is in scream range
            is_scream = (self.SCREAM_FREQ_MIN <= peak_freq <= self.SCREAM_FREQ_MAX)
            
            return is_scream, volume

        except Exception as e:
            return False, 0

    def process_chunk_full(self) -> AudioAnalysisResult:
        """
        Process audio chunk and check for both screams and keywords.
        
        Returns:
            AudioAnalysisResult with all detection results
        """
        is_scream, volume = self.process_chunk()
        
        # Check for detected keyword
        is_keyword = False
        keyword = None
        with self.keyword_lock:
            if self.keyword_detected:
                is_keyword = True
                keyword = self.keyword_detected
                self.keyword_detected = None  # Reset after reading
        
        return AudioAnalysisResult(
            is_scream=is_scream,
            is_keyword_detected=is_keyword,
            detected_keyword=keyword,
            volume=volume
        )
            
    def close(self):
        """Clean up resources."""
        self.stop_stream()
        self.p.terminate()
