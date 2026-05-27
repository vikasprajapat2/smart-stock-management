from pydantic import BaseModel


class UserCreate(BaseModel):

    full_name: str
    email: str
    password: str
    role: str = "STAFF"

class UserLogin(BaseModel):

    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True