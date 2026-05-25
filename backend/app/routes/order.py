from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.order_schema import OrderCreate, OrderResponse

router = APIRouter(
    prefix="/orders",
    tags=['Orders']
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
@router.post("/", response_model=OrderResponse)
def create_order(
    order: OrderCreate,
    db: Session = Depends(get_db)
):

    try:

        new_order = Order(
            customer_name=order.customer_name,
            total_amount=order.total_amount,
            status=order.status
        )

        db.add(new_order)

        db.commit()

        db.refresh(new_order)

        for item in order.items:

            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                price=item.price
            )

            db.add(order_item)

        db.commit()

        return new_order

    except Exception as e:

        return {"error": str(e)}