from pydantic import BaseModel

class InventoryCreate(BaseModel):
    product_id: int
    warehouse_id: int
    quantity_available: int
    quantity_reserved: int = 0

class InventoryResponse(InventoryCreate):
    id: int
    class Config:
        from_attributes = True
        