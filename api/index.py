# Vercel Serverless Function entrypoint
from backend.app.main import app

# Export app instance for Vercel Python runtime
app = app
