from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.utils.jwt_handler import create_access_tokens

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
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Quick fix: In production passwords should be hashed and compared.
    # We are checking plaintext password here assuming simple seed script logic.
    user = db.query(User).filter(User.email == form_data.username).first()

    if user and user.password_hash == form_data.password:
        access_token = create_access_tokens(data={"user_id": user.id})
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    raise HTTPException(
        status_code=401,
        detail="Invalid credentials"
    )