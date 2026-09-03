import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Base, User, UserRole, Factory, Report, ReportStatus
from app.auth import hash_password

def seed_db():
    db = SessionLocal()
    try:
        # Get users and factories
        qc_user = db.query(User).filter(User.email == "qc@example.com").first()
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        factory = db.query(Factory).first()
        
        if not (qc_user and admin_user and factory):
            print("Run previous seed first or ensure users/factories exist.")
            return

        comprehensive_report = Report(
            report_no="REP-COMPREHENSIVE-001",
            factory_id=factory.id,
            customer_name="MegaBrands LLC",
            po_number="PO-777888",
            status=ReportStatus.COMPLETED,
            created_by_id=admin_user.id,
            assigned_qc_id=qc_user.id,
            conclusion="PASSED",
            
            # ALL DATA FIELDS FILLED:
            header_info={"inspector": qc_user.name, "date": "2026-08-25", "supplier": "MegaBrands Supplier", "department": "Menswear"},
            product_category={"category": "Apparel", "item": "Men's Jacket", "style_number": "MJ-2026-X"},
            po_rows=[
                {"style": "MJ-2026-X", "color": "Navy", "size": "S", "qty": 500, "cartons": 25},
                {"style": "MJ-2026-X", "color": "Navy", "size": "M", "qty": 1000, "cartons": 50},
                {"style": "MJ-2026-X", "color": "Navy", "size": "L", "qty": 500, "cartons": 25},
            ],
            po_comments=[
                {"comment": "All quantities match the packing list."},
                {"comment": "No shortages found in selected cartons."}
            ],
            standards_reference={"reference_sample": "Available", "specs": "Provided by customer", "trim_card": "Available"},
            lab_test={"test_report_number": "TR-12345", "test_result": "Pass", "testing_lab": "SGS"},
            packing_matrix={"cartons_checked": 10, "units_per_carton": 20, "packing_method": "Flat pack"},
            marking_labeling={"care_label": "Correct", "main_label": "Correct", "hangtag": "Correct", "barcode": "Scannable"},
            upc_verification=[
                {"sku": "MJ-2026-X-S", "barcode": "123456789012", "scanned": True},
                {"sku": "MJ-2026-X-M", "barcode": "123456789013", "scanned": True},
            ],
            cartons_selected=[
                {"carton_no": "1", "qty": 20},
                {"carton_no": "5", "qty": 20},
                {"carton_no": "12", "qty": 20},
            ],
            aql_rows=[
                {"level": "II", "sample_size": 125, "major_allowed": 5, "minor_allowed": 7, "critical_allowed": 0}
            ],
            defects_meta={"major": 1, "minor": 3, "critical": 0},
            defects={
                "workmanship": [
                    {"defect": "Loose thread", "type": "Minor", "qty": 2},
                    {"defect": "Uneven stitching", "type": "Major", "qty": 1}
                ],
                "appearance": [
                    {"defect": "Small stain", "type": "Minor", "qty": 1}
                ]
            },
            measurements={
                "spec_sheet_used": "Spec v2",
                "sample_size": 5,
                "out_of_tolerance": 0
            },
            onsite_tests={
                "zipper_test": "Pass",
                "pull_test": "Pass",
                "rub_test": "Pass"
            },
            shrinkage={
                "warp": "-1.5%",
                "weft": "-1.0%",
                "result": "Within tolerance"
            }
        )
        
        db.add(comprehensive_report)
        db.commit()
        print("Successfully inserted comprehensive fake data!")
        
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
