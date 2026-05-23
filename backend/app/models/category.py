from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base

class Category(Base):
    __tablename__='categories'

    id = Column(Integer, primary_key=True, index=True)
    Category_name=Column(String(100), nullable=False)
    description=Column(Text)
    products= relationship("Products",back_populates='category')


     