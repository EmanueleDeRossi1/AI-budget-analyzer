import sys
import os

# In Docker the backend lives at /app; for local runs it should already be on the path.
_backend = os.environ.get("DJANGO_ROOT", "/app")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
