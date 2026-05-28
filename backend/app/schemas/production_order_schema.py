from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from app.schemas.product_schema import ProductResponse
from app.schemas.bom_schema import BOMResponse

class MaterialReservationResponse(BaseModel):
    id: int
    production_order_id: int
    product_id: int
    quantity_reserved: Decimal
    status: str
    created_at: datetime
    product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class ProductionOrderBase(BaseModel):
    production_order_number: str
    product_id: int
    bom_id: int
    quantity_to_produce: int
    status: Optional[str] = "DRAFT"

class ProductionOrderCreate(ProductionOrderBase):
    pass

class ProductionOrderUpdate(BaseModel):
    quantity_to_produce: Optional[int] = None
    status: Optional[str] = None
    bom_id: Optional[int] = None

class ProductionOrderResponse(ProductionOrderBase):
    id: int
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None
    bom: Optional[BOMResponse] = None
    reservations: List[MaterialReservationResponse] = []

    class Config:
        from_attributes = True

# Schema for availability check response
class ShortageItem(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str]
    required_qty: Decimal
    available_qty: Decimal
    shortage_qty: Decimal

class StockAvailabilityResponse(BaseModel):
    production_order_id: int
    can_produce: bool
    shortages: List[ShortageItem]
