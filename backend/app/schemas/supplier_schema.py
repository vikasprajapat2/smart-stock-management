from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class SupplierBase(BaseModel):
    supplier_name: str
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    supplier_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
