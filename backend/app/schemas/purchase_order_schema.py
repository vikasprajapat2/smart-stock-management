from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


class PurchaseOrderItemBase(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None

    class Config:
        from_attributes = True


class PurchaseOrderBase(BaseModel):
    supplier_id: int
    warehouse_id: Optional[int] = None
    status: Optional[str] = "PENDING"
    delivery_date: Optional[datetime] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate]


class PurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    warehouse_id: Optional[int] = None
    supplier_id: Optional[int] = None
    delivery_date: Optional[datetime] = None
    items: Optional[List[PurchaseOrderItemCreate]] = None


class PurchaseOrderResponse(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    warehouse_id: Optional[int] = None
    status: str
    order_date: datetime
    delivery_date: Optional[datetime] = None
    total_amount: Decimal
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseOrderItemResponse]

    class Config:
        from_attributes = True