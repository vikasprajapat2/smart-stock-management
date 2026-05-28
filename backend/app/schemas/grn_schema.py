from pydantic import BaseModel
from typing import List, Optional


class GRNItemCreate(BaseModel):

    product_id: int

    ordered_qty: int

    received_qty: int

    damaged_qty: Optional[int] = 0


class GRNCreate(BaseModel):

    purchase_order_id: int

    warehouse_id: int

    remarks: Optional[str] = None

    items: List[GRNItemCreate]


class GRNItemResponse(BaseModel):

    id: int

    product_id: int

    ordered_qty: int

    received_qty: int

    damaged_qty: int

    class Config:
        from_attributes = True


class GRNResponse(BaseModel):

    id: int

    purchase_order_id: int

    warehouse_id: int

    remarks: Optional[str]

    status: str

    items: List[GRNItemResponse]

    class Config:
        from_attributes = True