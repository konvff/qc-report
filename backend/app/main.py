import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .database import engine
from .models import Base, User, UserRole
from .auth import hash_password
from .database import SessionLocal
from .routers import auth, factories, reports

from sqlalchemy import text
Base.metadata.create_all(bind=engine)

def _run_migrations():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS measurement_options JSON DEFAULT '{}';"))
            conn.commit()
    except Exception as e:
        print(f"Migration notice: {e}")

_run_migrations()

# Create a default admin account on first run so there's always a way in.
def _ensure_default_admin():
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.role == UserRole.ADMIN).first():
            default_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@example.com")
            default_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "changeme123")
            admin = User(
                name="Admin",
                email=default_email,
                password_hash=hash_password(default_password),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print(f"Created default admin: {default_email} / {default_password} -- CHANGE THIS PASSWORD")
    finally:
        db.close()

_ensure_default_admin()

app = FastAPI(title="QC Inspection Report Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(factories.router)
app.include_router(reports.router)

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")
app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


@app.get("/health")
def health():
    return {"status": "ok"}
