from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base

class BOMVersion(Base):
    __tablename__ = "bom_versions"

    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    version_number = Column(String(20), nullable=False)
    revision_notes = Column(String(255))
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    effective_date = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationships
    bom = relationship("BOM", back_populates="versions", foreign_keys=[bom_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
