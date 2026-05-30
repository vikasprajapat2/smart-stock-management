from sqlalchemy import Column, Integer, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base

class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    rate = Column(DECIMAL(10,2), default=0.0)
    total = Column(DECIMAL(10,2), default=0.0)

    # Relationships
    sales_order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")