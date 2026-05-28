from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import datetime

from app.schemas.product_schema import ProductResponse
from app.schemas.user_schema import UserResponse

class BOMItemBase(BaseModel):
    material_product_id: int
    quantity_required: Decimal
    wastage_percent: Optional[Decimal] = Decimal("0.00")
    unit: Optional[str] = None
    remarks: Optional[str] = None

class BOMItemCreate(BOMItemBase):
    pass

class BOMItemResponse(BOMItemBase):
    id: int
    bom_id: int
    material_product: Optional[ProductResponse] = None

    class Config:
        from_attributes = True

class BOMBase(BaseModel):
    bom_number: str
    product_id: int
    version: Optional[str] = "1.0.0"
    description: Optional[str] = None
    raw_material_cost: Optional[Decimal] = Decimal("0.00")
    labor_cost: Optional[Decimal] = Decimal("0.00")
    overhead_cost: Optional[Decimal] = Decimal("0.00")
    total_cost: Optional[Decimal] = Decimal("0.00")
    status: Optional[str] = "DRAFT"

class BOMCreate(BOMBase):
    items: List[BOMItemCreate]

class BOMUpdate(BaseModel):
    version: Optional[str] = None
    description: Optional[str] = None
    raw_material_cost: Optional[Decimal] = None
    labor_cost: Optional[Decimal] = None
    overhead_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    status: Optional[str] = None
    items: Optional[List[BOMItemCreate]] = None

class BOMResponse(BOMBase):
    id: int
    approved_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None
    approved_by: Optional[UserResponse] = None
    items: List[BOMItemResponse] = []

    class Config:
        from_attributes = True

# Schema for Recursive Multi-level BOM tree
class BOMTreeNode(BaseModel):
    material_product_id: int
    product_name: str
    sku: Optional[str] = None
    quantity_required: Decimal
    unit: Optional[str] = None
    wastage_percent: Decimal
    total_cost: Decimal
    has_sub_bom: bool
    sub_bom_id: Optional[int] = None
    children: List['BOMTreeNode'] = []

    class Config:
        from_attributes = True
