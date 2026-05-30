from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DispatchItemBase(BaseModel):
    product_id: int
    quantity: int

class DispatchItemCreate(DispatchItemBase):
    pass

class DispatchItemResponse(DispatchItemBase):
    id: int
    dispatch_id: int

    class Config:
        from_attributes = True

class DispatchBase(BaseModel):
    dispatch_number: str
    sales_order_id: int
    remarks: Optional[str] = None

class DispatchCreate(DispatchBase):
    items: List[DispatchItemCreate]

class DispatchResponse(DispatchBase):
    id: int
    dispatch_date: datetime
    created_at: datetime
    updated_at: datetime
    items: List[DispatchItemResponse] = []

    class Config:
        from_attributes = True
