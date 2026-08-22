"""
Serverless Function entrypoint for deployment platforms (Vercel).
Exports the unified FastAPI application instance.
"""
import sys
from pathlib import Path

# Add repository root to sys.path so 'backend' and 'app' packages are always importable
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from backend.app.main import app
except ImportError:
    from app.main import app

# Export application callable for Vercel Python serverless runtime
app = app

