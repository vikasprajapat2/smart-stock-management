from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

class MaterialReservation(Base):
    __tablename__ = "material_reservations"

    id = Column(Integer, primary_key=True, index=True)
    production_order_id = Column(Integer, ForeignKey("production_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_reserved = Column(DECIMAL(10, 2), nullable=False)
    
    # Status: RESERVED, COMPLETED, RELEASED
    status = Column(String(50), default="RESERVED", nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    production_order = relationship("ProductionOrder", back_populates="reservations", foreign_keys=[production_order_id])
    product = relationship("Product", foreign_keys=[product_id])
