from sqlalchemy import (Column, Integer, ForeignKey, TIMESTAMP)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Inventory(Base):
    __tablename__="inventory"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('products.id'))
    warehouse_id = Column(Integer, ForeignKey('warehouses.id'))
    quantity_available = Column(Integer, default=0)
    quantity_reserved = Column(Integer, default=0)
    last_updated=Column(TIMESTAMP(timezone=True),server_default=func.now())
    product = relationship('Product')
    warehouse = relationship("Warehouse")