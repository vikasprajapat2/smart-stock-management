from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from sqlalchemy.orm import relationship

from sqlalchemy.sql import func

from app.database import Base


class GRN(Base):

    __tablename__ = "grns"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    purchase_order_id = Column(
        Integer,
        ForeignKey("purchase_orders.id"),
        nullable=False
    )

    warehouse_id = Column(
        Integer,
        ForeignKey("warehouses.id"),
        nullable=False
    )

    received_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    remarks = Column(String)

    status = Column(
        String,
        default="RECEIVED"
    )

    received_date = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    items = relationship(
        "GRNItem",
        back_populates="grn",
        cascade="all, delete"
    )