from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database import SessionLocal

from app.models.grn import GRN
from app.models.grn_item import GRNItem
from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog

from app.schemas.grn_schema import (
    GRNCreate,
    GRNResponse
)

router = APIRouter(
    prefix="/grn",
    tags=["GRN"]
)


def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


@router.post(
    "/receive",
    response_model=GRNResponse
)
def receive_goods(
    data: GRNCreate,
    db: Session = Depends(get_db)
):

    new_grn = GRN(
        purchase_order_id=data.purchase_order_id,
        warehouse_id=data.warehouse_id,
        received_by=1,
        remarks=data.remarks
    )

    db.add(new_grn)

    db.commit()

    db.refresh(new_grn)

    for item in data.items:

        grn_item = GRNItem(
            grn_id=new_grn.id,
            product_id=item.product_id,
            ordered_qty=item.ordered_qty,
            received_qty=item.received_qty,
            damaged_qty=item.damaged_qty
        )

        db.add(grn_item)

        inventory = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.warehouse_id == data.warehouse_id
        ).first()

        if inventory:

            old_qty = inventory.quantity

            inventory.quantity += item.received_qty

            new_qty = inventory.quantity

        else:

            old_qty = 0

            inventory = Inventory(
                product_id=item.product_id,
                warehouse_id=data.warehouse_id,
                quantity=item.received_qty,
                quantity_reserved=0
            )

            db.add(inventory)

            new_qty = item.received_qty

        log = InventoryLog(
            product_id=item.product_id,
            warehouse_id=data.warehouse_id,
            old_quantity=old_qty,
            new_quantity=new_qty,
            quantity_changed=item.received_qty,
            action="PURCHASE_IN"
        )

        db.add(log)

    db.commit()

    db.refresh(new_grn)

    return new_grn