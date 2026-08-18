from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routes.api import router
from .services.migrations import run_migrations
from .services.seed import seed_database


app = FastAPI(title="Sky Banking API", version="1.0.0")

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


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    with SessionLocal() as db:
        seed_database(db)




@app.get("/")
def root():
    return {"name": "Sky Banking API", "status": "ok"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/health")
def api_health():
    return {"status": "healthy"}
