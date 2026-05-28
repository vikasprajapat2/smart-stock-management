from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base

class BOMItem(Base):
    __tablename__ = "bom_items"

    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    material_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity_required = Column(DECIMAL(10, 2), nullable=False)
    wastage_percent = Column(DECIMAL(5, 2), default=0.00)
    unit = Column(String(20))
    remarks = Column(String(255))

    # Relationships
    bom = relationship("BOM", back_populates="items", foreign_keys=[bom_id])
    material_product = relationship("Product", foreign_keys=[material_product_id])
