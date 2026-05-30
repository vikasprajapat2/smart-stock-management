from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font('Helvetica', 'B', 16)
pdf.cell(200, 10, text='Invoice', new_x='LMARGIN', new_y='NEXT', align='C')
print('No errors!')
