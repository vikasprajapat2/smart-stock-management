from pydantic import BaseModel
from typing import Optional

class WarehouseBase(BaseModel):
    warehouse_name: str
    location: Optional[str] = None
    manager_id: Optional[int] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    warehouse_name: Optional[str] = None
    location: Optional[str] = None
    manager_id: Optional[int] = None

class WarehouseResponse(WarehouseBase):
    id: int

    class Config:
        from_attributes = True
