from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.product import Product
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.models.purchase_order import PurchaseOrder


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


# DATABASE DEPENDENCY
def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# DASHBOARD STATS
@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db)
):

    total_products = db.query(Product).count()

    total_inventory = db.query(Inventory).count()

    unread_notifications = db.query(Notification).filter(
        Notification.is_read == False
    ).count()

    purchase_orders = db.query(PurchaseOrder).count()

    return {
        "total_products": total_products,
        "total_inventory": total_inventory,
        "unread_notifications": unread_notifications,
        "purchase_orders": purchase_orders
    }