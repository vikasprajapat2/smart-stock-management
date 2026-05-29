from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.schemas.category_schema import CategoryResponse


class ProductBase(BaseModel):

    product_name: str = Field(..., min_length=2, max_length=255)

    sku: str = Field(..., min_length=3, max_length=100)

    barcode: Optional[str] = Field(None, max_length=100)

    category_id: Optional[int] = None

    selling_price: Optional[Decimal] = Field(default=Decimal('0.00'), ge=0)

    reorder_level: Optional[int] = Field(default=0, ge=0)

    unit: Optional[str] = Field(default="pcs")

    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):

    product_name: Optional[str] = Field(None, min_length=2)

    sku: Optional[str] = Field(None, min_length=3)

    barcode: Optional[str] = None

    category_id: Optional[int] = None

    selling_price: Optional[Decimal] = Field(None, ge=0)

    reorder_level: Optional[int] = Field(None, ge=0)

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

    barcode: str = Field(..., min_length=3)

    action: str = Field(..., pattern="^(IN|OUT)$")

    warehouse_id: int

    quantity: int = Field(default=1, ge=1)


class ProductScanResponse(BaseModel):

    product_name: str

    sku: str

    barcode: str

    warehouse_id: int

    quantity: int

    action: str

    message: str