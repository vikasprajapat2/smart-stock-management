from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.schemas.category_schema import CategoryResponse

class ProductBase(BaseModel):
    product_name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    selling_price: Optional[Decimal] = None
    reorder_level: Optional[int] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    category_id: Optional[int] = None
    selling_price: Optional[Decimal] = None
    reorder_level: Optional[int] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    stock_quantity: int = 0
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True


class ProductScanRequest(BaseModel):
    barcode: str
    action: str  # "IN" or "OUT"
    warehouse_id: int
    quantity: Optional[int] = 1


class ProductScanResponse(BaseModel):
    product_name: str
    sku: str
    barcode: str
    warehouse_id: int
    quantity_available: int
    action: str
    message: str

