from pydantic import BaseModel, Field, ConfigDict


class InventoryCreate(BaseModel):
    product_id: int
    warehouse_id: int
    # accept `quantity` in request payload and map it to `quantity_available`
    quantity_available: int = Field(..., alias="quantity")
    quantity_reserved: int = 0

    model_config = ConfigDict(populate_by_name=True)


class InventoryResponse(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    # Database column is `quantity`, but serialize as `quantity_available`
    quantity_available: int = Field(..., alias="quantity")
    quantity_reserved: int

    model_config = ConfigDict(from_attributes=True)
        