from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    warehouse_name = Column(String(100), nullable=False)
    location = Column(String(255))
    manager_id = Column(Integer, ForeignKey('users.id'))

    manager = relationship("User")
