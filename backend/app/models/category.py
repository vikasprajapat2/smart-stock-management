from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base

class Category(Base):
<<<<<<< HEAD
    __tablename__='categories'

    id = Column(Integer, primary_key=True, index=True)
    Category_name=Column(String(100), nullable=False)
    description=Column(Text)
    products= relationship("Products",back_populates='category')


     
=======
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), nullable=False)
    description = Column(Text)
    
    products = relationship("Product", back_populates='category')
>>>>>>> 1c3dee527eb9ce5995a3082f91c4606433882d0d
