from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id = Column(Integer, primary_key=True, index=True)
    production_order_number = Column(String(100), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    quantity_to_produce = Column(Integer, nullable=False)
    
    # Status: DRAFT, PENDING, APPROVED, IN_PRODUCTION, COMPLETED, CANCELLED
    status = Column(String(50), default="DRAFT", nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    product = relationship("Product", foreign_keys=[product_id])
    bom = relationship("BOM", foreign_keys=[bom_id])
    reservations = relationship("MaterialReservation", back_populates="production_order", cascade="all, delete-orphan")
    purchase_requests = relationship("PurchaseRequest", back_populates="production_order")
