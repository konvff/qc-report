import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, Enum, JSON, Boolean
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    QC = "qc"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.QC)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Factory(Base):
    __tablename__ = "factories"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    location = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ReportStatus(str, enum.Enum):
    DRAFT = "draft"              # admin section started, QC section pending
    QC_IN_PROGRESS = "qc_in_progress"
    COMPLETED = "completed"      # ready to generate


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    report_no = Column(String, unique=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"))
    customer_name = Column(String)
    po_number = Column(String)
    status = Column(Enum(ReportStatus), default=ReportStatus.DRAFT)

    created_by_id = Column(Integer, ForeignKey("users.id"))
    assigned_qc_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # All section data stored as JSON blobs -- flexible for the many
    # differently-shaped tables in the template without needing 25 tables.
    header_info = Column(JSON, default=dict)
    product_category = Column(JSON, default=dict)
    po_rows = Column(JSON, default=list)
    po_comments = Column(JSON, default=list)
    standards_reference = Column(JSON, default=dict)
    lab_test = Column(JSON, default=dict)
    packing_matrix = Column(JSON, default=dict)
    marking_labeling = Column(JSON, default=dict)
    upc_verification = Column(JSON, default=list)
    cartons_selected = Column(JSON, default=list)

    aql_rows = Column(JSON, default=list)
    conclusion = Column(String, default="PENDING")
    defects_meta = Column(JSON, default=dict)
    defects = Column(JSON, default=dict)
    measurements = Column(JSON, default=dict)
    onsite_tests = Column(JSON, default=dict)
    shrinkage = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    factory = relationship("Factory")
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_qc = relationship("User", foreign_keys=[assigned_qc_id])
    photos = relationship("ReportPhoto", back_populates="report", cascade="all, delete-orphan")


class ReportPhoto(Base):
    __tablename__ = "report_photos"
    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id"))
    section = Column(String, nullable=False)   # e.g. "standards_photos", "defect_photos"
    row = Column(Integer, nullable=False, default=0)
    col = Column(Integer, nullable=False, default=0)
    title = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    report = relationship("Report", back_populates="photos")
