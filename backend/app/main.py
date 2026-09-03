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
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE reports ADD COLUMN IF NOT EXISTS measurement_options JSON DEFAULT '{}';"))
    except Exception as e:
        print(f"Migration notice: {e}")

_run_migrations()

from .models import Factory

def _ensure_default_seed():
    db = SessionLocal()
    try:
        admin_email = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@example.com")
        admin_pass = os.environ.get("DEFAULT_ADMIN_PASSWORD", "changeme123")
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            admin = User(
                name="Admin",
                email=admin_email,
                password_hash=hash_password(admin_pass),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.commit()
            print(f"Created default admin: {admin_email}")
        elif "DEFAULT_ADMIN_PASSWORD" in os.environ:
            admin.password_hash = hash_password(admin_pass)
            db.commit()
            print("Updated admin password from env")

        qc_email = os.environ.get("DEFAULT_QC_EMAIL", "qc@example.com")
        qc_pass = os.environ.get("DEFAULT_QC_PASSWORD", "changeme123")
        qc = db.query(User).filter(User.role == UserRole.QC).first()
        if not qc:
            qc = User(
                name="QC Inspector",
                email=qc_email,
                password_hash=hash_password(qc_pass),
                role=UserRole.QC,
            )
            db.add(qc)
            db.commit()
            print(f"Created default QC user: {qc_email}")
        elif "DEFAULT_QC_PASSWORD" in os.environ:
            qc.password_hash = hash_password(qc_pass)
            db.commit()
            print("Updated QC password from env")

        if not db.query(Factory).first():
            factory = Factory(name="Default Factory", location="Main Site")
            db.add(factory)
            db.commit()
            print("Created default Factory")
    except Exception as e:
        print(f"Seed notice: {e}")
    finally:
        db.close()

_ensure_default_seed()

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
