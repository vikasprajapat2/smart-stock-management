from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from app.database import SessionLocal
from app.models.user import User

SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login"
)

def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("user_id")

        if user_id is None:

            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

        db = SessionLocal()

        user = db.query(User).filter(
            User.id == user_id
        ).first()

        if not user:

            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        return {
            "user_id": user.id,
            "role": user.role.role_name
        }

    except JWTError:

        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )


def require_admin(
    current_user: dict = Depends(get_current_user)
):

    if current_user["role"].lower() != "admin":

        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    return current_user


def require_staff(
    current_user: dict = Depends(get_current_user)
):

    allowed_roles = [
        "admin",
        "staff",
        "manager"
    ]

    if current_user["role"].lower() not in allowed_roles:

        raise HTTPException(
            status_code=403,
            detail="Staff access required"
        )

    return current_user