import os
import tempfile
from pathlib import Path

os.environ["SAFECITY_MODEL_PRELOAD"] = "false"
os.environ["SAFECITY_DATABASE_PATH"] = str(
    Path(tempfile.gettempdir()) / "safecity-inference-tests.db"
)

