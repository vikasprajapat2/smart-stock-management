from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

class SalesOrderItemBase(BaseModel):
    product_id: int
    quantity: int
    rate: float
    total: float

class SalesOrderItemCreate(SalesOrderItemBase):
    pass

class SalesOrderItemResponse(SalesOrderItemBase):
    id: int
    sales_order_id: int

    class Config:
        from_attributes = True

class SalesOrderBase(BaseModel):
    sales_order_number: str
    customer_id: int
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    remarks: Optional[str] = None
    status: Optional[str] = "DRAFT"
    total_amount: float = 0.0

class SalesOrderCreate(SalesOrderBase):
    items: List[SalesOrderItemCreate]

class SalesOrderUpdate(BaseModel):
    expected_delivery_date: Optional[date] = None
    remarks: Optional[str] = None
    status: Optional[str] = None

class SalesOrderResponse(SalesOrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    items: List[SalesOrderItemResponse] = []

    class Config:
        from_attributes = True