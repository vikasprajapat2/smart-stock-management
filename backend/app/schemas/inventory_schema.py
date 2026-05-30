from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class InventoryUpdate(BaseModel):

    quantity: Optional[int] = Field(None, ge=0)

    quantity_reserved: Optional[int] = Field(None, ge=0)


class InventoryCreate(BaseModel):

    product_id: int

    warehouse_id: int

    quantity_available: int = Field(
        ...,
        alias="quantity",
        ge=0
    )

    quantity_reserved: int = Field(
        0,
        ge=0
    )

    model_config = ConfigDict(
        populate_by_name=True
    )


class InventoryResponse(BaseModel):

    id: int

    product_id: int

    warehouse_id: int

    quantity: int

    quantity_reserved: int

    last_updated: datetime

    model_config = ConfigDict(
        from_attributes=True
    )