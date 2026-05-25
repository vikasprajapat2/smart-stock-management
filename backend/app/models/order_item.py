from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DECIMAL
)

from app.database import Base


class OrderItem(Base):

    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(
        Integer,
        ForeignKey("orders.id")
    )

    product_id = Column(Integer)

    quantity = Column(Integer)

    price = Column(DECIMAL(10,2))