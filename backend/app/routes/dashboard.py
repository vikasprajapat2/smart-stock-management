from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import SessionLocal

from app.models.product import Product
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.models.purchase_order import PurchaseOrder
from app.models.order import SalesOrder
from app.models.warehouse import Warehouse
from app.models.supplier import Supplier
from app.models.bom import BOM
from app.models.production_order import ProductionOrder

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
    
    # Low stock calculation
    # Items where inventory quantity is <= product.reorder_level
    low_stock_alerts = db.query(Inventory).join(Product).filter(
        Inventory.quantity <= Product.reorder_level,
        Product.reorder_level > 0
    ).count()

    total_inventory_records = db.query(Inventory).count()
    total_inventory_quantity = db.query(func.sum(Inventory.quantity)).scalar() or 0

    unread_notifications = db.query(Notification).filter(
        Notification.is_read == False
    ).count()

    purchase_orders = db.query(PurchaseOrder).count()
    # Orders statistics
    total_sales_orders = db.query(SalesOrder).count()
    completed_sales_orders = db.query(SalesOrder).filter(SalesOrder.status == 'COMPLETED').count()
    total_suppliers = db.query(Supplier).count()
    total_warehouses = db.query(Warehouse).count()
    
    total_boms = db.query(BOM).count()
    active_production_orders = db.query(ProductionOrder).filter(
        ProductionOrder.status == 'IN_PROGRESS'
    ).count()

    return {
        "total_products": total_products,
        "low_stock_alerts": low_stock_alerts,
        "total_inventory_records": total_inventory_records,
        "total_inventory_quantity": total_inventory_quantity,
        "unread_notifications": unread_notifications,
        "purchase_orders": purchase_orders,
        "sales_orders": total_sales_orders,
        "total_warehouses": total_warehouses,
        "total_suppliers": total_suppliers,
        "total_boms": total_boms,
        "active_production_orders": active_production_orders
    }
