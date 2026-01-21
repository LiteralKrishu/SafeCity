
import speech_recognition as sr
import threading

class VoiceTrigger:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.is_listening = False
        self.keywords = ["help", "save me", "emergency", "activate"]
        
    def start_listening(self, callback):
        self.is_listening = True
        self.callback = callback
        t = threading.Thread(target=self._listen_loop)
        t.daemon = True
        t.start()
        
    def _listen_loop(self):
        while self.is_listening:
            try:
                # Use microphone (requires PyAudio)
                # In a real mobile service, this would be a constant stream analysis
                # Here we use a generic placeholder loop
                pass 
                # with sr.Microphone() as source:
                #     audio = self.recognizer.listen(source, timeout=5)
                #     text = self.recognizer.recognize_google(audio)
                #     if any(k in text.lower() for k in self.keywords):
                #         self.callback(text)
            except:
                pass
                
    def stop(self):
        self.is_listening = False
