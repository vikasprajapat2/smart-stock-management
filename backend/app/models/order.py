from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, ForeignKey, DateTime, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base

class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_number = Column(String(100), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    order_date = Column(Date, default=datetime.utcnow)
    expected_delivery_date = Column(Date, nullable=True)
    remarks = Column(String(500), nullable=True)
    status = Column(String(50), default="DRAFT") # DRAFT, APPROVED, PARTIAL_PRODUCTION, READY_FOR_DISPATCH, COMPLETED, CANCELLED
    total_amount = Column(DECIMAL(10,2), default=0.0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer")
    items = relationship("SalesOrderItem", back_populates="sales_order", cascade="all, delete-orphan")
    production_orders = relationship("ProductionOrder", back_populates="sales_order")
    dispatches = relationship("Dispatch", back_populates="sales_order")