from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    TIMESTAMP
)

from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Supplier(Base):

    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)

    supplier_name = Column(String(100), nullable=False)

    contact_name = Column(String(100))

    email = Column(String(100))

    phone = Column(String(20))

    address = Column(String(255))
    gst_number = Column(String(20), nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )

    purchase_orders = relationship(
        "PurchaseOrder",
        back_populates="supplier",
        cascade="all, delete"
    )