from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class Warehouse(Base):

    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)

    warehouse_name = Column(String, nullable=False)

    location = Column(String, nullable=False)

    manager_id = Column(Integer, ForeignKey("users.id"))

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    manager = relationship("User")