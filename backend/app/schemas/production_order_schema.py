from pydantic import BaseModel
from datetime import datetime


class ProductionOrderCreate(BaseModel):

    product_id: int

    bom_id: int

    quantity_to_produce: int


class ProductionOrderResponse(BaseModel):

    id: int

    product_id: int

    bom_id: int

    quantity_to_produce: int

    status: str

    created_at: datetime

    class Config:

        from_attributes = True