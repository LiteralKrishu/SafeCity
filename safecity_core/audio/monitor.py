
import pyaudio
import numpy as np
import scipy.fftpack

class AudioMonitor:
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
        
    def start_stream(self):
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
            except Exception as e:
                print(f"Error opening audio stream: {e}")
                self.is_listening = False

    def stop_stream(self):
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
        self.is_listening = False

    def process_chunk(self):
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
            # print(f"Audio processing error: {e}")
            return False, 0
            
    def close(self):
        self.stop_stream()
        self.p.terminate()
