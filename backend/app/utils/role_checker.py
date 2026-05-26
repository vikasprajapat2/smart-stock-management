from fastapi import Depends, HTTPException
from app.utils.auth_middleware import get_current_user

def require_admin(
        current_user = Depends(get_current_user)

):
    if current_user['role'] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user

def require_staff(
        current_user = Depends(get_current_user)
):
    if current_user['role'] not in ['admin', 'staff']:
        raise HTTPException(
            status_code=403,
            detail='Staff access required'
        )

    return current_user

