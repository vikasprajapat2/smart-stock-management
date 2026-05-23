from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    Warehouse_name = Column(String(100))
    location = Column(String(255))
    manager_id = Column(Integer, ForeignKey('users.id'))

