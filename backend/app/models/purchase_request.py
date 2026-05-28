from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_required = Column(DECIMAL(10, 2), nullable=False)
    
    # Status: PENDING, APPROVED, PO_CREATED
    status = Column(String(50), default="PENDING", nullable=False)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    product = relationship("Product", foreign_keys=[product_id])
    production_order = relationship("ProductionOrder", back_populates="purchase_requests", foreign_keys=[production_order_id])
