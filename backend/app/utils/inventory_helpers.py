from sqlalchemy.orm import Session
from app.models.inventory_log import InventoryLog
from app.models.notification import Notification
from app.models.product import Product
from app.models.warehouse import Warehouse

def log_inventory_change(db: Session, product_id: int, old_qty: int, new_qty: int, action: str):
    """
    Log an inventory quantity update to the inventory_logs table.
    """
    log_entry = InventoryLog(
        product_id=product_id,
        old_quantity=old_qty,
        new_quantity=new_qty,
        action=action
    )
    db.add(log_entry)

def check_and_trigger_low_stock_alert(db: Session, product_id: int, warehouse_id: int, quantity: int):
    """
    Check if the current inventory quantity is below the reorder level for the product.
    If so, raise a warning notification with warehouse details, preventing duplicate unread alerts.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    warehouse = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()

    if not product or not warehouse:
        return

    # Only trigger if product has a reorder level and current quantity is <= reorder level
    if product.reorder_level is not None and quantity <= product.reorder_level:
        title = "Low Stock Alert"
        message = f"Low stock alert: {product.product_name} has only {quantity} {product.unit or 'units'} left in warehouse {warehouse.warehouse_name}."

        # Prevent duplicate unread warning alerts for this product & warehouse
        duplicate = db.query(Notification).filter(
            Notification.is_read == False,
            Notification.type == "warning",
            Notification.title == title,
            Notification.message.like(f"%{product.product_name}%"),
            Notification.message.like(f"%{warehouse.warehouse_name}%")
        ).first()

        if not duplicate:
            notification = Notification(
                title=title,
                message=message,
                type="warning",
                is_read=False
            )
            db.add(notification)
