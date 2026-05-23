<<<<<<< HEAD
from  sqlalchemy import Column, Integer, String , Boolean, ForeignKey, TIMESTAMP 
=======
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, TIMESTAMP 
>>>>>>> 1c3dee527eb9ce5995a3082f91c4606433882d0d
from sqlalchemy.orm import relationship 
from sqlalchemy.sql import func

from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
<<<<<<< HEAD
    full_name= Column(String(100), nullable=False)
    email=Column(String(100), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phone = Column(String(20))
    role_id=Column(Integer,ForeignKey('roles.id'))
    is_active = Column(Boolean,default=True)
    created_at=Column(TIMESTAMP(timezone=True),server_default=func.now())
    role = relationship("role", back_populates='users')
=======
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    phone = Column(String(20))
    role_id = Column(Integer, ForeignKey('roles.id'))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    
    role = relationship("Role", back_populates='users')
>>>>>>> 1c3dee527eb9ce5995a3082f91c4606433882d0d
