from pydantic import BaseModel
from typing import List
from datetime import datetime 

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    price: float

class OrderCreate(BaseModel):
    customer_name: str
    total_amount: float
    status: str
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    id: int

    customer_name: str

    total_amount: float

    status: str

    created_at: datetime

    class Config:
        from_attributes = True