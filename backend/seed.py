import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Base, User, UserRole, Factory, Report, ReportStatus
from app.auth import hash_password

def seed_db():
    db = SessionLocal()
    try:
        # Create a QC user if not exists
        qc_user = db.query(User).filter(User.email == "qc@example.com").first()
        if not qc_user:
            qc_user = User(
                name="QC Tester",
                email="qc@example.com",
                password_hash=hash_password("password123"),
                role=UserRole.QC
            )
            db.add(qc_user)
            db.commit()
            db.refresh(qc_user)
        
        # Get admin user
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin_user:
            admin_user = User(
                name="Admin Tester",
                email="admin2@example.com",
                password_hash=hash_password("password123"),
                role=UserRole.ADMIN
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        # Create Factories
        factories = db.query(Factory).all()
        if not factories:
            factories = [
                Factory(name="Global Textiles", location="Dhaka, Bangladesh"),
                Factory(name="Apex Apparel", location="Ho Chi Minh City, Vietnam"),
                Factory(name="Oceanic Garments", location="Karachi, Pakistan")
            ]
            db.add_all(factories)
            db.commit()
            for f in factories:
                db.refresh(f)
        
        # Create Reports
        existing_reports = db.query(Report).count()
        if True:
            reports = [
                Report(
                    report_no="REP-2026-001",
                    factory_id=factories[0].id,
                    customer_name="Acme Corp",
                    po_number="PO-999001",
                    status=ReportStatus.DRAFT,
                    created_by_id=admin_user.id,
                    assigned_qc_id=qc_user.id,
                    header_info={"inspector": qc_user.name, "date": "2026-08-24"},
                    conclusion="PENDING"
                ),
                Report(
                    report_no="REP-2026-002",
                    factory_id=factories[1].id,
                    customer_name="Globex Inc",
                    po_number="PO-999002",
                    status=ReportStatus.QC_IN_PROGRESS,
                    created_by_id=admin_user.id,
                    assigned_qc_id=qc_user.id,
                    header_info={"inspector": qc_user.name, "date": "2026-08-23"},
                    conclusion="PENDING",
                    defects_meta={"major": 2, "minor": 5, "critical": 0}
                ),
                Report(
                    report_no="REP-2026-003",
                    factory_id=factories[2].id,
                    customer_name="Initech",
                    po_number="PO-999003",
                    status=ReportStatus.COMPLETED,
                    created_by_id=admin_user.id,
                    assigned_qc_id=qc_user.id,
                    header_info={"inspector": qc_user.name, "date": "2026-08-22"},
                    conclusion="PASSED",
                    defects_meta={"major": 0, "minor": 1, "critical": 0},
                    po_rows=[{"style": "T-Shirt", "color": "Red", "size": "M", "qty": 100}]
                )
            ]
            db.add_all(reports)
            db.commit()
            print("Successfully inserted fake data!")
        else:
            print("Reports already exist, skipping fake data generation.")
            
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
