from sqlalchemy import (
    Column,
    Integer,
    String,
    DECIMAL,
    TIMESTAMP
)
 
from sqlalchemy.sql import func

from app.database import Base


class Order(Base):

    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    customer_name = Column(String(100))

    total_amount = Column(DECIMAL(10,2))

    status = Column(String(50))

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )