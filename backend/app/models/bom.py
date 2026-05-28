from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

class BOM(Base):
    __tablename__ = "boms"

    id = Column(Integer, primary_key=True, index=True)
    bom_number = Column(String(100), unique=True, nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    version = Column(String(20), default="1.0.0", nullable=False)
    description = Column(String(255))
    
    # Cost fields
    raw_material_cost = Column(DECIMAL(10, 2), default=0.00)
    labor_cost = Column(DECIMAL(10, 2), default=0.00)
    overhead_cost = Column(DECIMAL(10, 2), default=0.00)
    total_cost = Column(DECIMAL(10, 2), default=0.00)
    
    status = Column(String(50), default="DRAFT", nullable=False)  # DRAFT, SUBMITTED, APPROVED
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    product = relationship("Product", back_populates="boms", foreign_keys=[product_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("BOMItem", back_populates="bom", cascade="all, delete-orphan")
    versions = relationship("BOMVersion", back_populates="bom", cascade="all, delete-orphan")
