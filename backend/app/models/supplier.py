from sqlalchemy import (Column, Interger, String, DECIMAL, Boolean, ForeignKey,TiMESTAMP)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
class Product(Base):
    __tablename__="Products"

    id = Column(Interger, primary_key=True, index=True)
    produnct_name= Column(String(100), nullable=False)
    sku=Column(String(100),unique=True)
    barcode=Column(String(100))
    category_id= Column(Interger,ForeignKey("categories.id"))
    selling_price = Column(DECIMAL(10,2))
    reorder_level= Column(Interger)
    unit = Column(String(20))
    is_active=Column( Boolean, default=True)
    created_at = Column(TiMESTAMP(timezone=True), server_default=func.now())
    category = relationship('Category',back_populates='products')



 