import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase, sessionmaker


BASE_DIR = Path(__file__).resolve().parents[1]

# Prefer the active Neon integration on Vercel. Older POSTGRES_URL values can
# remain attached to a project after a database integration is replaced.
DATABASE_URL = next(
    (
        os.getenv(name)
        for name in (
            "DATABASE_URL",
            "NEON_DATABASE_URL",
            "NEON_POSTGRES_URL",
            "NEON_POSTGRES_PRISMA_URL",
            "POSTGRES_URL",
            "POSTGRES_PRISMA_URL",
        )
        if os.getenv(name)
    ),
    None,
)

# If still not found, set default SQLite DB
if not DATABASE_URL:
    if os.getenv("VERCEL") == "1":
        DATABASE_URL = "sqlite:////tmp/sky_banking.db"
    else:
        DATABASE_URL = f"sqlite:///{BASE_DIR / 'sky_banking.db'}"

# SQLAlchemy requires postgresql:// instead of postgres://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Managed Postgres providers (e.g. the Supabase pooler) append vendor-specific
# query params such as `?supa=base-pooler.x`, which psycopg2 rejects with
# `invalid dsn: invalid connection option "supa"`. Keep only the options libpq
# actually understands.
_ALLOWED_PG_OPTIONS = {
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "channel_binding",
    "connect_timeout",
    "application_name",
    "options",
    "target_session_attrs",
}


def _clean_postgres_url(url: str) -> str:
    if not url.startswith("postgresql"):
        return url
    parsed = urlsplit(url)
    if not parsed.query:
        return url
    kept = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() in _ALLOWED_PG_OPTIONS
    ]
    return urlunsplit(parsed._replace(query=urlencode(kept)))


DATABASE_URL = _clean_postgres_url(DATABASE_URL)

is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {"connect_timeout": 10}
engine_options = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
}
if os.getenv("VERCEL") == "1" and not is_sqlite:
    engine_options["poolclass"] = NullPool

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
