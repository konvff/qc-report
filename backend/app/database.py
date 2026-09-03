import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Uses PostgreSQL in production (set DATABASE_URL env var on host), falls back
# to local SQLite for easy local testing.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./qc_reports.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
