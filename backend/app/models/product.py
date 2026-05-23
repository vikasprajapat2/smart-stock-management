<<<<<<< HEAD
from sqlalchemy import (Column, Integer, String, DECIMAL, Boolean, ForeignKey,TIMESTAMP)
=======
from sqlalchemy import (Column, Integer, String, DECIMAL, Boolean, ForeignKey, TIMESTAMP)
>>>>>>> 1c3dee527eb9ce5995a3082f91c4606433882d0d
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
<<<<<<< HEAD
class Product(Base):
    __tablename__="Products"

    id = Column(Integer, primary_key=True, index=True)
    produnct_name= Column(String(100), nullable=False)
    sku=Column(String(100),unique=True)
    barcode=Column(String(100))
    category_id= Column(Integer,ForeignKey("categories.id"))
    selling_price = Column(DECIMAL(10,2))
    reorder_level= Column(Integer)
    unit = Column(String(20))
    is_active=Column( Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    category = relationship('Category',back_populates='products')
=======

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(100), nullable=False)
    sku = Column(String(100), unique=True)
    barcode = Column(String(100))
    category_id = Column(Integer, ForeignKey("categories.id"))
    selling_price = Column(DECIMAL(10,2))
    reorder_level = Column(Integer)
    unit = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    category = relationship('Category', back_populates='products')
>>>>>>> 1c3dee527eb9ce5995a3082f91c4606433882d0d
