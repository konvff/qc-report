import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any
import json

def _ensure_dict(val):
    if isinstance(val, str):
        try: return json.loads(val)
        except: return {}
    return val or {}

def _ensure_list(val):
    if isinstance(val, str):
        try: return json.loads(val)
        except: return []
    return val or []

from ..database import get_db
from ..models import Report, ReportPhoto, ReportStatus, User
from ..auth import get_current_user
from ..generator import generate_report, discover_photo_slots, DEFECT_TAXONOMY

router = APIRouter(prefix="/api/reports", tags=["reports"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated")
TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates", "master_template.docx")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Computed once at import time, straight from the template -- never hand
# transcribed, so titles/positions can never drift out of sync with it.
PHOTO_SLOTS = discover_photo_slots(TEMPLATE_PATH)

ADMIN_SECTIONS = {
    "header_info", "product_category", "po_rows", "po_comments",
    "standards_reference", "lab_test", "packing_matrix", "marking_labeling",
    "upc_verification", "cartons_selected", "customer_name", "po_number",
}
QC_SECTIONS = {
    "aql_rows", "conclusion", "defects", "defects_meta", "measurements",
    "measurement_options", "onsite_tests", "shrinkage",
}
PHOTO_SECTIONS = set(PHOTO_SLOTS.keys())


class ReportCreate(BaseModel):
    report_no: str
    factory_id: int | None = None
    customer_name: str | None = None
    po_number: str | None = None
    assigned_qc_id: int | None = None


class ReportOut(BaseModel):
    id: int
    report_no: str
    factory_id: int | None
    customer_name: str | None
    po_number: str | None
    status: ReportStatus

    class Config:
        from_attributes = True


class SectionUpdate(BaseModel):
    section: str
    data: Any


@router.get("/photo-slots")
def get_photo_slots(_user: User = Depends(get_current_user)):
    """The full list of named photo slots (with default titles) derived
    directly from the customer's template, plus the fixed defect taxonomy
    used for defect_photos captions."""
    return {"slots": PHOTO_SLOTS, "defect_taxonomy": DEFECT_TAXONOMY}


@router.post("", response_model=ReportOut)
def create_report(payload: ReportCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.query(Report).filter(Report.report_no == payload.report_no).first():
        raise HTTPException(status_code=400, detail="Report number already exists")
    r = Report(
        report_no=payload.report_no,
        factory_id=payload.factory_id,
        customer_name=payload.customer_name,
        po_number=payload.po_number,
        created_by_id=user.id,
        assigned_qc_id=payload.assigned_qc_id,
        status=ReportStatus.DRAFT,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.get("", response_model=list[ReportOut])
def list_reports(
    factory_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Report)
    if factory_id:
        q = q.filter(Report.factory_id == factory_id)
    if status_filter:
        q = q.filter(Report.status == status_filter)
    return q.order_by(Report.created_at.desc()).all()


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    photos = db.query(ReportPhoto).filter(ReportPhoto.report_id == report_id).all()
    result = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    result["photos"] = [
        {"id": p.id, "section": p.section, "row": p.row, "col": p.col,
         "title": p.title, "url": f"/api/reports/photo/{p.id}"}
        for p in photos
    ]
    return result


@router.patch("/{report_id}/section")
def update_section(
    report_id: int,
    payload: SectionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")

    section = payload.section
    if section in ADMIN_SECTIONS and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can edit this section")
    if section in QC_SECTIONS and user.role not in ("qc", "admin"):
        raise HTTPException(status_code=403, detail="Only QC can edit this section")
    if not hasattr(r, section):
        raise HTTPException(status_code=400, detail=f"Unknown section: {section}")

    setattr(r, section, payload.data)
    if r.status == ReportStatus.DRAFT and section in QC_SECTIONS:
        r.status = ReportStatus.QC_IN_PROGRESS
    db.commit()
    return {"ok": True}


@router.post("/{report_id}/photos")
async def upload_photo(
    report_id: int,
    section: str = Form(...),
    row: int = Form(...),
    col: int = Form(...),
    title: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if section not in PHOTO_SECTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown photo section: {section}")

    # Replace whatever's already in this exact slot, if anything.
    existing = db.query(ReportPhoto).filter(
        ReportPhoto.report_id == report_id, ReportPhoto.section == section,
        ReportPhoto.row == row, ReportPhoto.col == col,
    ).first()
    if existing:
        if os.path.exists(existing.file_path):
            os.remove(existing.file_path)
        db.delete(existing)
        db.flush()

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    fname = f"{report_id}_{section}_{row}_{col}_{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as out:
        shutil.copyfileobj(file.file, out)

    photo = ReportPhoto(report_id=report_id, section=section, row=row, col=col,
                         title=title, file_path=fpath)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return {"id": photo.id, "url": f"/api/reports/photo/{photo.id}"}


@router.patch("/photo/{photo_id}/title")
def update_photo_title(photo_id: int, title: str = Form(...), db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    p = db.query(ReportPhoto).filter(ReportPhoto.id == photo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    p.title = title
    db.commit()
    return {"ok": True}


@router.get("/photo/{photo_id}")
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    p = db.query(ReportPhoto).filter(ReportPhoto.id == photo_id).first()
    if not p or not os.path.exists(p.file_path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(p.file_path)


@router.delete("/photo/{photo_id}")
def delete_photo(photo_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(ReportPhoto).filter(ReportPhoto.id == photo_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if os.path.exists(p.file_path):
        os.remove(p.file_path)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{report_id}/generate")
def generate(report_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")

    photos = db.query(ReportPhoto).filter(ReportPhoto.report_id == report_id).all()
    photos_by_section: dict[str, list[dict]] = {}
    for p in photos:
        photos_by_section.setdefault(p.section, []).append({
            "row": p.row, "col": p.col, "title": p.title, "path": p.file_path,
        })

    data = {
        "header_info": _ensure_dict(r.header_info),
        "product_category": _ensure_dict(r.product_category),
        "po_rows": _ensure_list(r.po_rows),
        "po_comments": _ensure_list(r.po_comments),
        "aql_rows": _ensure_list(r.aql_rows),
        "conclusion": r.conclusion or "PENDING",
        "defects_meta": _ensure_dict(r.defects_meta),
        "defects": _ensure_dict(r.defects),
        "standards_reference": _ensure_dict(r.standards_reference),
        "lab_test": _ensure_dict(r.lab_test),
        "packing_matrix": _ensure_dict(r.packing_matrix),
        "marking_labeling": _ensure_dict(r.marking_labeling),
        "cartons_selected": _ensure_list(r.cartons_selected),
        "upc_verification": _ensure_list(r.upc_verification),
        "measurements": _ensure_dict(r.measurements),
        "measurement_options": _ensure_dict(getattr(r, "measurement_options", {})),
        "onsite_tests": _ensure_dict(r.onsite_tests),
        "shrinkage": _ensure_dict(r.shrinkage),
        "photos": photos_by_section,
    }

    out_path = os.path.join(OUTPUT_DIR, f"report_{r.report_no.replace('/', '-')}.docx")
    generate_report(TEMPLATE_PATH, out_path, data)

    r.status = ReportStatus.COMPLETED
    db.commit()

    return {"ok": True, "download_url": f"/api/reports/{report_id}/download"}

@router.get("/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    out_path = os.path.join(OUTPUT_DIR, f"report_{r.report_no.replace('/', '-')}.docx")
    if not os.path.exists(out_path):
        raise HTTPException(status_code=404, detail="Report not generated yet")
    return FileResponse(
        out_path,
        filename=f"{r.report_no}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
