from app.models.notification import Notification


def log_inventory_change(
    db,
    product_id,
    old_qty,
    new_qty,
    action
):
    print(
        f"[INVENTORY LOG] Product: {product_id} | "
        f"{old_qty} -> {new_qty} | Action: {action}"
    )


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