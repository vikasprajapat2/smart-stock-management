from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

SECRET_KEY = 'mysecretkey'
ALGORITHM = "HS256"

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
            raise HTTPExecption(
                status_code=401,
                detail = "Invalid token"
            )
        return payload
    except JWTError:

        raise HTTPExecption(
            status_code=401,
            detail='Could not validate token'
        )
    