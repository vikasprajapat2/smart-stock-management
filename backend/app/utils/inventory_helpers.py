from app.models.notification import Notification
from app.models.inventory_log import InventoryLog
from app.models.inventory import Inventory
from app.models.notification import Notification


def log_inventory_change(
    db,
    product_id,
    old_qty,
    new_qty,
    action
):
    inventory = db.query(Inventory).filter(
        Inventory.product_id == product_id
    ).first()

    warehouse_id = inventory.warehouse_id if inventory else 1

    log = InventoryLog(
        product_id=product_id,
        warehouse_id=warehouse_id,
        old_quantity=old_qty,
        new_quantity=new_qty,
        quantity_changed=new_qty - old_qty,
        action=action
    )

    db.add(log)

def check_and_trigger_low_stock_alert(
    db,
    product_id,
    warehouse_id,
    quantity
):
    if quantity <= 5:

        notification = Notification(
            title="Low Stock Alert",
            message=f"Product ID {product_id} is low in stock."
        )

        db.add(notification)