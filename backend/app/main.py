from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db, is_sqlite, metadata
from .routes.api import router
from .services.migrations import run_migrations
from .services.seed import seed_database


def init_db():
    metadata.create_all(bind=engine)
    try:
        run_migrations(engine)
    except Exception as e:
        print(f"Migration notice: {e}")
    try:
        with SessionLocal() as db:
            seed_database(db)
    except Exception as e:
        print(f"Seed notice: {e}")


# Initialize database schemas and seed default users on module load
try:
    init_db()
except Exception as exc:
    print(f"Initial DB bootstrap notice: {exc}")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        init_db()
    except Exception as e:
        print(f"Lifespan DB notice: {e}")
    yield


app = FastAPI(title="Sky Banking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def vercel_path_rewrite_middleware(request: Request, call_next):
    matched_path = (
        request.headers.get("x-matched-path")
        or request.headers.get("x-vercel-matched-path")
        or request.headers.get("x-forwarded-uri")
    )
    if matched_path:
        clean = matched_path.split("?")[0]
        request.scope["path"] = clean
    elif request.scope.get("path") in ("/api/index.py", "/api/index", "/api", "/api/"):
        path_param = request.query_params.get("path")
        if path_param:
            request.scope["path"] = f"/api/{path_param.lstrip('/')}"
    return await call_next(request)


# Register router for both with and without /api prefix to support all Vercel rewrite patterns
app.include_router(router, prefix="/api")
app.include_router(router)


@app.get("/")
def root():
    return {
        "name": "Sky Banking API",
        "version": "1.0.0",
        "status": "online",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/health")
@app.get("/api/health")
def api_health(db: Session = Depends(get_db)):
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy",
        "database": db_status,
        "engine": "sqlite" if is_sqlite else "postgresql",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
