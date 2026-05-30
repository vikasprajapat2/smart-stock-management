from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.invoice import Invoice
from app.database import Base

engine = create_engine('postgresql://postgres:postgres@localhost/smartstock')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

invoice = db.query(Invoice).first()
if invoice:
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(200, 10, text=f'Invoice: {invoice.invoice_number}', new_x='LMARGIN', new_y='NEXT', align='C')
    print('Invoice generated successfully.')
else:
    print('No invoice found.')
