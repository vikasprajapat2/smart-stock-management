from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

from app.schemas.product_schema import ProductResponse

class PurchaseRequestBase(BaseModel):
    product_id: int
    quantity_required: Decimal
    status: Optional[str] = "PENDING"
    production_order_id: Optional[int] = None

class PurchaseRequestCreate(PurchaseRequestBase):
    pass

class PurchaseRequestResponse(PurchaseRequestBase):
    id: int
    created_at: datetime
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True
