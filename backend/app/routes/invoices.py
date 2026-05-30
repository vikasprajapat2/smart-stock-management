from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
from fpdf import FPDF

from app.database import get_db
from app.models.invoice import Invoice
from app.models.order import SalesOrder
from app.models.customer import Customer
from app.schemas.invoice_schema import InvoiceCreate, InvoiceResponse

router = APIRouter(prefix="/invoices", tags=["Invoices"])

@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(invoice_data: InvoiceCreate, db: Session = Depends(get_db)):
    so = db.query(SalesOrder).filter(SalesOrder.id == invoice_data.sales_order_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
        
    cust = db.query(Customer).filter(Customer.id == invoice_data.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    new_invoice = Invoice(
        invoice_number=invoice_data.invoice_number,
        sales_order_id=invoice_data.sales_order_id,
        customer_id=invoice_data.customer_id,
        invoice_date=invoice_data.invoice_date,
        subtotal=invoice_data.subtotal,
        tax=invoice_data.tax,
        grand_total=invoice_data.grand_total
    )
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@router.get("/", response_model=List[InvoiceResponse])
def get_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Invoice).offset(skip).limit(limit).all()

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(invoice_id: int, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(200, 10, txt=f"Invoice: {invoice.invoice_number}", ln=True, align="C")
    
    pdf.set_font("Arial", size=12)
    pdf.cell(200, 10, txt=f"Date: {invoice.invoice_date}", ln=True)
    pdf.cell(200, 10, txt=f"Customer ID: {invoice.customer_id}", ln=True)
    pdf.cell(200, 10, txt=f"Sales Order ID: {invoice.sales_order_id}", ln=True)
    
    pdf.cell(200, 10, txt=f"Subtotal: {invoice.subtotal}", ln=True)
    pdf.cell(200, 10, txt=f"Tax: {invoice.tax}", ln=True)
    pdf.cell(200, 10, txt=f"Grand Total: {invoice.grand_total}", ln=True)
    
    pdf_bytes = pdf.output(dest='S').encode('latin1')
    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"}
    )
