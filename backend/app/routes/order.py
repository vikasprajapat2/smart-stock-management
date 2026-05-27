from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.models.product import Product

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

        # CREATE MAIN ORDER
        new_order = Order(
            customer_name=order.customer_name,
            total_amount=order.total_amount,
            status=order.status
        )

        db.add(new_order)

        db.commit()

        db.refresh(new_order)

        notification = Notification(
            title="New Sales Order",
            message=f"Order #{new_order.id} received from {new_order.customer_name} for ${new_order.total_amount}.",
            type="info"
        )
        db.add(notification)

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
            inventory.quantity -= item.quantity

            # CREATE ORDER ITEM
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price
            )

            db.add(order_item)

            # LOW STOCK CHECK
            product = db.query(Product).filter(
                Product.id == inventory.product_id
            ).first()

            if inventory.quantity <= product.reorder_level:

                notification = Notification(
                    title="Low Stock Alert",
                    message=f"{product.product_name} stock is low",
                    type="warning"
                )

                db.add(notification)

        db.commit()

        db.refresh(new_order)

        return new_order

    except HTTPException:
        raise

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