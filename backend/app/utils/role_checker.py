from fastapi import Depends, HTTPException, status
from app.auth.dependencies import get_current_user
from app.models.user import User

def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.role or current_user.role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_manager(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.role or current_user.role.upper() not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    return current_user

def require_staff(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.role or current_user.role.upper() not in ["ADMIN", "MANAGER", "STAFF"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )
    return current_user
