from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    customer_code = Column(String, unique=True, index=True, nullable=False)
    customer_name = Column(String, nullable=False)
    contact_person = Column(String)
    mobile = Column(String)
    email = Column(String)
    gst_number = Column(String)
    billing_address = Column(String)
    shipping_address = Column(String)
    city = Column(String)
    state = Column(String)
    country = Column(String)
    status = Column(String, default="ACTIVE")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # sales_orders = relationship("SalesOrder", back_populates="customer")
