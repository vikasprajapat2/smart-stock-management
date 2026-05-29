from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class StockMovement(Base):

    __tablename__ = "stock_movements"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=False
    )

    movement_type = Column(
        String(50),
        nullable=False
    )  # IN, OUT, TRANSFER, ADJUSTMENT

    quantity = Column(
        Integer,
        nullable=False
    )

    reference = Column(
        String(100),
        nullable=True
    )

    remarks = Column(
        String(255),
        nullable=True
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    product = relationship("Product")

    warehouse = relationship("Warehouse")

    creator = relationship("User", foreign_keys=[created_by])
