
import json
import os
from typing import Dict, Any

class ConfigLoader:
    _instance = None
    _config: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ConfigLoader, cls).__new__(cls)
            cls._instance.load_config()
        return cls._instance

    def load_config(self):
        # Determine path relative to this file
        base_path = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(base_path, "config.json")
        
        try:
            with open(config_path, "r") as f:
                self._config = json.load(f)
        except Exception as e:
            print(f"Error loading config.json: {e}. Using defaults.")
            self._config = {}

    @property
    def vision(self):
        return self._config.get("vision", {})

    @property
    def audio(self):
        return self._config.get("audio", {})
        
    @property
    def risk(self):
        return self._config.get("risk", {})

# Singleton instance
config = ConfigLoader()
