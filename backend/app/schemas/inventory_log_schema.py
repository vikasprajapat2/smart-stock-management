from pydantic import BaseModel
from datetime import datetime


class InventoryLogResponse(BaseModel):

    id: int

    product_id: int

    warehouse_id: int | None = None

    old_quantity: int

    new_quantity: int

    quantity_changed: int | None = None

    action: str

    timestamp: datetime

    class Config:
        from_attributes = True