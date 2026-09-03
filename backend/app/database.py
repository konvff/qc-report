import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Uses PostgreSQL in production (set DATABASE_URL env var on host), falls back
# to local SQLite for easy local testing.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./qc_reports.db")

# Fix Railway & Heroku postgres:// scheme compatibility for SQLAlchemy 1.4/2.0
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300 if not DATABASE_URL.startswith("sqlite") else -1
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
