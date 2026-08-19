import os
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db, is_sqlite
from .routes.api import router
from .services.migrations import run_migrations
from .services.seed import seed_database
from . import models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema, execute migrations and seed default data
    Base.metadata.create_all(bind=engine)
    try:
        run_migrations(engine)
    except Exception as e:
        print(f"Lifespan migration notice: {e}")
    try:
        with SessionLocal() as db:
            seed_database(db)
    except Exception as e:
        print(f"Lifespan seed notice: {e}")
    yield


app = FastAPI(title="Sky Banking API", version="1.0.0", lifespan=lifespan)

# Compress JSON API responses > 1000 bytes for faster loading
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173", 
        "http://localhost:5173",
        "https://sky-bank-v12-3j1vqlgku-ahsanullahqureshi888-6759s-projects.vercel.app",
        "https://sky-bank-v12.vercel.app",
        "https://skyariana-bank.vercel.app",
        "https://frontend-sable-ten-54.vercel.app",
        "https://frontend-qz56kqsg7-sky-ariana-balam-bar-baran.vercel.app",
        "https://sky-banking-frontend.vercel.app",
        "https://skybanks.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "Sky Banking API",
        "version": "1.0.0",
        "status": "online",
        "timestamp": datetime.utcnow().isoformat()
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
        "timestamp": datetime.utcnow().isoformat()
    }
