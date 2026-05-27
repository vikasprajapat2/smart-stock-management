from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.database import Base


class InventoryLog(Base):

    __tablename__ = "inventory_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    product_id = Column(Integer)

    old_qty = Column(Integer)

    new_qty = Column(Integer)

    action = Column(String)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )