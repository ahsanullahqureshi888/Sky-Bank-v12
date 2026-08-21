"""
Serverless Function entrypoint for deployment platforms.
Exports the unified FastAPI application instance.
"""
from backend.app.main import app

# Export application callable
app = app
