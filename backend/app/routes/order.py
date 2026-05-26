from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.models.product import Product
from app.utils.inventory_helpers import log_inventory_change, check_and_trigger_low_stock_alert

from app.schemas.order_schema import (
    OrderCreate,
    OrderResponse
)

router = APIRouter(
    prefix="/orders",
    tags=["Orders"]
)


# DATABASE DEPENDENCY
def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# CREATE ORDER
@router.post("/", response_model=OrderResponse)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db)
):

    try:
        # CREATE MAIN ORDER BUT DO NOT COMMIT YET
        new_order = Order(
            customer_name=order.customer_name,
            total_amount=order.total_amount,
            status=order.status
        )

        db.add(new_order)
        db.flush()  # Flushes changes to generate ID without committing transaction

        # PROCESS ORDER ITEMS
        for item in order.items:

            # CHECK INVENTORY
            inventory = db.query(Inventory).filter(
                Inventory.product_id == item.product_id
            ).first()

            if not inventory:
                raise HTTPException(
                    status_code=404,
                    detail=f"Inventory not found for product {item.product_id}"
                )

            # CHECK STOCK
            if inventory.quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for product {item.product_id}"
                )

            # REDUCE STOCK
            old_qty = inventory.quantity
            inventory.quantity -= item.quantity
            new_qty = inventory.quantity

            # CREATE ORDER ITEM
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price
            )

            db.add(order_item)

            # LOG INVENTORY CHANGE
            log_inventory_change(
                db=db,
                product_id=item.product_id,
                old_qty=old_qty,
                new_qty=new_qty,
                action="ORDER_DEDUCTION"
            )

            # LOW STOCK CHECK (WAREHOUSE-BASED & DEDUPLICATED)
            check_and_trigger_low_stock_alert(
                db=db,
                product_id=item.product_id,
                warehouse_id=inventory.warehouse_id,
                quantity=new_qty
            )

        db.commit()
        db.refresh(new_order)
        return new_order

    except HTTPException as he:
        db.rollback()
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# GET ALL ORDERS
@router.get("/")
def get_orders(
    db: Session = Depends(get_db)
):

    orders = db.query(Order).all()

    return orders


# GET SINGLE ORDER
@router.get("/{order_id}")
def get_single_order(
    order_id: int,
    db: Session = Depends(get_db)
):

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order:

        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    return order


# DELETE ORDER
@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db)
):

    order = db.query(Order).filter(
        Order.id == order_id
    ).first()

    if not order:

        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    db.delete(order)

    db.commit()

    return {"message": "Order deleted successfully"}