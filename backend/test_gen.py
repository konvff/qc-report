import sys
from app.database import SessionLocal
from app.models import Report, ReportPhoto
from app.generator import generate_report
import os

db = SessionLocal()
r = db.query(Report).order_by(Report.id.desc()).first()
if not r:
    print("No report found")
    sys.exit(0)

print(f"Generating for report {r.report_no} (id: {r.id})")
print(f"po_rows type: {type(r.po_rows)}")
print(f"po_rows content: {repr(r.po_rows)[:100]}")

photos = db.query(ReportPhoto).filter(ReportPhoto.report_id == r.id).all()
photos_by_section = {}
for p in photos:
    photos_by_section.setdefault(p.section, []).append({
        "row": p.row, "col": p.col, "title": p.title, "path": p.file_path,
    })

data = {
    "header_info": r.header_info or {},
    "product_category": r.product_category or {},
    "po_rows": r.po_rows or [],
    "po_comments": r.po_comments or [],
    "aql_rows": r.aql_rows or [],
    "conclusion": r.conclusion or "PENDING",
    "defects_meta": r.defects_meta or {},
    "defects": r.defects or {},
    "standards_reference": r.standards_reference or {},
    "lab_test": r.lab_test or {},
    "packing_matrix": r.packing_matrix or {},
    "marking_labeling": r.marking_labeling or {},
    "cartons_selected": r.cartons_selected or [],
    "upc_verification": r.upc_verification or [],
    "measurements": r.measurements or {},
    "onsite_tests": r.onsite_tests or {},
    "shrinkage": r.shrinkage or {},
    "photos": photos_by_section,
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "app", "generated")
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "app", "templates", "master_template.docx")
out_path = os.path.join(OUTPUT_DIR, f"test_output.docx")

try:
    generate_report(TEMPLATE_PATH, out_path, data)
    print("Generation successful!")
except Exception as e:
    import traceback
    traceback.print_exc()
    print("Failed!")
