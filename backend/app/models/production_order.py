from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy.sql import func

from app.database import Base


class ProductionOrder(Base):

    __tablename__ = "production_orders"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.id"))

    bom_id = Column(Integer, ForeignKey("boms.id"))

    quantity_to_produce = Column(Integer, nullable=False)

    status = Column(String, default="PENDING")

    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")

    bom = relationship("BOM")

    reservations = relationship(
        "MaterialReservation",
        back_populates="production_order"
    )

    purchase_requests = relationship(
        "PurchaseRequest",
        back_populates="production_order"
    )
    production_order_number = Column(
        String,
        unique=True,
        nullable=False
    )
    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )