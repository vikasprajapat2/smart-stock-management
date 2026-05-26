from fastapi import APIRouter
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import APIRouter, HTTPException, Depends

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
def login(
    form_data: OAuth2PasswordRequestForm = Depends()
):

    if (
        form_data.username == "admin@gmail.com"
        and form_data.password == "123456"
    ):

        return {
            "access_token": "testtoken123",
            "token_type": "bearer"
        }

    raise HTTPException(
        status_code=401,
        detail="Invalid credentials"
    )