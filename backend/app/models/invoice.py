from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), unique=True, index=True, nullable=False)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    invoice_date = Column(Date, default=datetime.utcnow)
    
    subtotal = Column(DECIMAL(10,2), default=0.0)
    tax = Column(DECIMAL(10,2), default=0.0)
    grand_total = Column(DECIMAL(10,2), default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sales_order = relationship("SalesOrder")
    customer = relationship("Customer")
