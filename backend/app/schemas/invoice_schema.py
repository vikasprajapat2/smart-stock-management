from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

class InvoiceBase(BaseModel):
    invoice_number: str
    sales_order_id: int
    customer_id: int
    invoice_date: Optional[date] = None
    subtotal: float = 0.0
    tax: float = 0.0
    grand_total: float = 0.0

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceResponse(InvoiceBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
