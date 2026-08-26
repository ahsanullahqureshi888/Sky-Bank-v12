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

DEFAULT_NEON_URL = "postgresql://neondb_owner:npg_gR8KSGOXbds6@ep-falling-cake-aip6g4pv-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"

if not DATABASE_URL:
    DATABASE_URL = DEFAULT_NEON_URL
elif DATABASE_URL.startswith("postgres://"):
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
if not is_sqlite:
    if os.getenv("VERCEL") == "1":
        engine_options["poolclass"] = NullPool
    else:
        engine_options.update({
            "pool_recycle": 300,
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
        })

try:
    engine = create_engine(DATABASE_URL, **engine_options)
except Exception as e:
    print(f"Database engine init fallback: {e}")
    tmp_db_path = "/tmp/sky_banking.db" if os.name != "nt" else str(BASE_DIR / "sky_banking.db")
    DATABASE_URL = f"sqlite:///{tmp_db_path}"
    is_sqlite = True
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


metadata = Base.metadata


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
