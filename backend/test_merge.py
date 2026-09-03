from docx import Document

d = Document('app/templates/master_template.docx')
t = d.tables[16] # measurement_chart
print("Original rows:", len(t.rows))

# keep header (row 0), delete the rest
for row in t.rows[1:]:
    t._tbl.remove(row._tr)

print("Rows after deletion:", len(t.rows))

# add a new row
row1 = t.add_row()
row1.cells[0].text = "12345"
row1.cells[1].text = "(Blue)"

row2 = t.add_row()
row2.cells[0].text = "Sheet"
row2.cells[1].text = "Width"
row2.cells[2].text = "50"

row3 = t.add_row()
# to merge cell 0 of row2 and row3:
a = row2.cells[0]
b = row3.cells[0]
a.merge(b)

row3.cells[1].text = "Length"
row3.cells[2].text = "100"

d.save('app/generated/test_merge.docx')
print("Saved test_merge.docx")
