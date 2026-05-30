from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    TIMESTAMP
)

from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Inventory(Base):

    __tablename__ = "inventory"

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

    quantity = Column(
        Integer,
        default=0
    )

    quantity_reserved = Column(
        Integer,
        default=0
    )

    last_updated = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    product = relationship("Product")

    warehouse = relationship("Warehouse")