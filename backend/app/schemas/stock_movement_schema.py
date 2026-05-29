from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class StockMovementCreate(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    reference: Optional[str] = None
    remarks: Optional[str] = None


class StockTransferCreate(BaseModel):
    product_id: int
    source_warehouse_id: int
    destination_warehouse_id: int
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    reference: Optional[str] = None
    remarks: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    movement_type: str
    quantity: int
    reference: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
