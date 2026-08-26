"""
Serverless Function entrypoint for deployment platforms (Vercel).
Exports the unified FastAPI application instance.
"""
import os
import sys
from pathlib import Path

# Add repository root to sys.path so 'backend' and 'app' packages are always importable
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure Neon PostgreSQL is always the active live database URL on serverless
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_gR8KSGOXbds6@ep-falling-cake-aip6g4pv-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

try:
    from backend.app.main import app
except ImportError:
    from app.main import app

# Export application callable for Vercel Python serverless runtime
app = app

