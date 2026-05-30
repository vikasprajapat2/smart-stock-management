from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)

from sqlalchemy.sql import func

from app.database import Base


class InventoryLog(Base):

    __tablename__ = "inventory_logs"

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

    warehouse_id = Column(Integer)

    old_quantity = Column(
        Integer,
        nullable=False
    )

    new_quantity = Column(
        Integer,
        nullable=False
    )

    quantity_changed = Column(Integer)

    action = Column(
        String(100),
        nullable=False
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )