# Vercel Serverless Function entrypoint
import urllib.parse
from backend.app.main import app as fastapi_app

async def app(scope, receive, send):
    """
    ASGI entrypoint wrapper for Vercel Python runtime.
    Restores the original request path from Vercel's rewrite metadata
    so FastAPI routes match correctly.
    """
    if scope["type"] == "http":
        headers = dict(scope.get("headers", []))
        
        # Check standard Vercel routing headers
        matched_path = headers.get(b"x-matched-path", b"").decode("utf-8")
        if not matched_path:
            matched_path = headers.get(b"x-vercel-matched-path", b"").decode("utf-8")
        if not matched_path:
            matched_path = headers.get(b"x-forwarded-uri", b"").decode("utf-8")
            
        current_path = scope.get("path", "")
        
        if matched_path and matched_path != current_path:
            clean_path = matched_path.split("?")[0]
            scope["path"] = clean_path
        elif current_path in ("/api/index.py", "/api/index", "/api", "/api/"):
            qs = scope.get("query_string", b"").decode("utf-8")
            parsed_qs = urllib.parse.parse_qs(qs)
            if "path" in parsed_qs and parsed_qs["path"]:
                subpath = parsed_qs["path"][0].lstrip("/")
                scope["path"] = f"/api/{subpath}"
                remaining_params = {k: v for k, v in parsed_qs.items() if k != "path"}
                scope["query_string"] = urllib.parse.urlencode(remaining_params, doseq=True).encode("utf-8")

    return await fastapi_app(scope, receive, send)
