from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification
from app.schemas.notification_schema import (
    NotificationCreate,
    NotificationResponse
)

router = APIRouter()


@router.post("/", response_model=NotificationResponse)
def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db)
):
    new_notification = Notification(
        title=notification.title,
        message=notification.message,
        type=notification.type
    )

    db.add(new_notification)
    db.commit()
    db.refresh(new_notification)

    return new_notification


@router.get("/", response_model=list[NotificationResponse])
def get_notifications(db: Session = Depends(get_db)):
    return db.query(Notification).all()


@router.put("/{id}/read")
def mark_as_read(id: int, db: Session = Depends(get_db)):

    notification = db.query(Notification).filter(
        Notification.id == id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    notification.is_read = True

    db.commit()

    return {"message": "Notification marked as read"}