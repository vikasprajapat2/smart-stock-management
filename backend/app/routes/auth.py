from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.get("/")
def test_auth():

    return {
        "message": "Auth route working"
    }


@router.post("/login")
def login(data: LoginRequest):

    return {
        "message": "Login successful",
        "email": data.email,
        "access_token": "testtoken123",
        "token_type": "bearer"
    }