import os
import json
from app.database import SessionLocal
from app.models import Report, User, Factory, ReportStatus
from app.extractor import parse_document_content
from app.routers.reports import _build_report_file

def test_full_extraction_and_report_creation():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.role == "admin").first()
        factory = db.query(Factory).first()
        if not user or not factory:
            print("DB missing admin or factory. Run seed script first.")
            return

        sample_po_text = """
Purchase Order B-PO13696
Vendor Factory Gohar Textile Mills Abrar Zia 3KM Jhumra Road, Khurrianawala Faisalabad, 38000 Pakistan
Ship-to Address : KID INTERNATIONAL LOGISTICS AB Prognosgatan 22 SE-504 64 Borås Sweden
Payment Terms DA60 Transport Method SEA Shipping Dock Karachi
Customer Document No. PO02976 Order Date 13-04-26
No. Description Ass. Qty. Direct Unit Cost Amount
B-22261 ILB82973 - Bed linen Teddy - GOTS STANDARD, 100X130+38X55 cm. Tariff No. 6302210089 Country of origin PK 400 4,95 1.980,00
B-22261 ILB82973 - Bed linen Teddy - GOTS STANDARD, 80x100+35x40 cm Tariff No. 6302210089 Country of origin PK 1.800 3,70 6.660,00
B-22261 ILB82973 - Bed linen Teddy - GOTS STANDARD, 65x80+35x40 cm Tariff No. 6302210089 Country of origin PK 2.000 3,15 6.300,00

Purchase Order B-PO13696 - Barcodes
No. Variant Description Barcode EAN Polybag EAN Carton SU per Polybag/Carton
B-22261 100163-321-17950 5-SE JUNIO STANDARD, 100X130+38X55 cm. 7068650006301 5/10
B-22261 100163-321-03754 5-NO CHILD STANDARD, 80x100+35x40 cm 7068650006295 5/10
B-22261 100163-321-03739 5-NO BABY STANDARD, 65x80+35x40 cm 7068650006288 5/10

Instruction Sheet B-22261 ILB82973 - Bed linen Teddy - GOTS
Unit of Measure: SET
CONSTRUCTION 30/30 76/68 FABRIC WEIGHT 110 GSM PACKAGING FABRIC BAG WITH HANGTAG QUALITY 100% Gots Cotton
"""

        extracted = parse_document_content(sample_po_text)
        print("1. Extraction Successful!")
        print("PO Number:", extracted.get("po_number"))
        print("Extracted PO Rows count:", len(extracted.get("po_rows", [])))

        # Verify barcode number is assigned as SKU
        po_rows = extracted.get("po_rows", [])
        assert len(po_rows) == 3, "Expected 3 PO rows"
        assert po_rows[0]["sku"] == "7068650006301", f"Expected SKU 7068650006301, got {po_rows[0]['sku']}"
        assert po_rows[1]["sku"] == "7068650006295", f"Expected SKU 7068650006295, got {po_rows[1]['sku']}"
        assert po_rows[2]["sku"] == "7068650006288", f"Expected SKU 7068650006288, got {po_rows[2]['sku']}"
        print("2. Barcode SKUs verified:", [r["sku"] for r in po_rows])

        # Create report in DB
        report_no = f"TEST-EXTRACT-{extracted.get('po_number')}"
        existing = db.query(Report).filter(Report.report_no == report_no).first()
        if existing:
            db.delete(existing)
            db.commit()

        report = Report(
            report_no=report_no,
            factory_id=factory.id,
            customer_name=extracted.get("customer_name"),
            po_number=extracted.get("po_number"),
            status=ReportStatus.DRAFT,
            created_by_id=user.id,
            header_info=extracted.get("header_info"),
            product_category=extracted.get("product_category"),
            po_rows=extracted.get("po_rows"),
            upc_verification=extracted.get("upc_verification"),
            standards_reference=extracted.get("standards_reference"),
            packing_matrix=extracted.get("packing_matrix"),
            aql_rows=extracted.get("aql_rows"),
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        print("3. Report Created with ID:", report.id)

        # Build Word document file to ensure generator works with extracted data
        out_path = _build_report_file(report, db)
        assert os.path.exists(out_path), "Generated report docx missing"
        print("4. Document generated successfully at:", out_path)

        # Cleanup test report
        db.delete(report)
        db.commit()
        print("5. Test completed cleanly!")
    finally:
        db.close()

if __name__ == "__main__":
    test_full_extraction_and_report_creation()
