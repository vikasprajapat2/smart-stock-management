from sqlalchemy import (
    Column,
    Integer,
    ForeignKey
)

from sqlalchemy.orm import relationship

from app.database import Base


class GRNItem(Base):

    __tablename__ = "grn_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    grn_id = Column(
        Integer,
        ForeignKey("grns.id"),
        nullable=False
    )

    product_id = Column(
        Integer,
        ForeignKey("products.id"),
        nullable=False
    )

    ordered_qty = Column(Integer)

    received_qty = Column(Integer)

    damaged_qty = Column(
        Integer,
        default=0
    )

    grn = relationship(
        "GRN",
        back_populates="items"
    )