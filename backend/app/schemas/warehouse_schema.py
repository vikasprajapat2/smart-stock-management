from pydantic import BaseModel, Field

from typing import Optional

from datetime import datetime


class WarehouseBase(BaseModel):

    warehouse_name: str = Field(
        ...,
        min_length=2,
        max_length=100
    )

    location: Optional[str] = None

    manager_id: Optional[int] = None


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):

    warehouse_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100
    )

    location: Optional[str] = None

    manager_id: Optional[int] = None


class WarehouseResponse(WarehouseBase):

    id: int

    created_at: datetime

    class Config:
        from_attributes = True