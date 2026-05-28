from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from app.database import SessionLocal

from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.notification import Notification

from app.schemas.inventory_schema import (
    InventoryCreate,
    InventoryResponse,
    InventoryUpdate
)

from app.schemas.inventory_log_schema import (
    InventoryLogResponse
)

from app.utils.role_checker import (
    require_admin,
    require_staff
)

from app.utils.auth_middleware import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"]
)


# DATABASE DEPENDENCY
def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# CREATE INVENTORY
@router.post(
    "/",
    response_model=InventoryResponse
)
def create_inventory(
    inventory: InventoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):

    try:

        # CHECK PRODUCT
        product = db.query(Product).filter(
            Product.id == inventory.product_id
        ).first()

        if not product:

            raise HTTPException(
                status_code=404,
                detail="Product not found"
            )

        # CHECK WAREHOUSE
        warehouse = db.query(Warehouse).filter(
            Warehouse.id == inventory.warehouse_id
        ).first()

        if not warehouse:

            raise HTTPException(
                status_code=404,
                detail="Warehouse not found"
            )

        # DUPLICATE CHECK
        existing_inventory = db.query(Inventory).filter(
            Inventory.product_id == inventory.product_id,
            Inventory.warehouse_id == inventory.warehouse_id
        ).first()

        if existing_inventory:

            raise HTTPException(
                status_code=400,
                detail="Inventory already exists for this product and warehouse"
            )

        # RESERVED VALIDATION
        if (
            inventory.quantity_reserved >
            inventory.quantity_available
        ):

            raise HTTPException(
                status_code=400,
                detail="Reserved quantity cannot exceed total quantity"
            )

        # CREATE INVENTORY
        new_inventory = Inventory(
            product_id=inventory.product_id,
            warehouse_id=inventory.warehouse_id,
            quantity=inventory.quantity_available,
            quantity_reserved=inventory.quantity_reserved
        )

        db.add(new_inventory)

        db.commit()

        db.refresh(new_inventory)

        # CREATE INVENTORY LOG
        log = InventoryLog(
            product_id=inventory.product_id,
            warehouse_id=inventory.warehouse_id,
            old_quantity=0,
            new_quantity=new_inventory.quantity,
            quantity_changed=new_inventory.quantity,
            action="IN"
        )

        db.add(log)

        # LOW STOCK ALERT
        if (
            product.reorder_level is not None
            and new_inventory.quantity <= product.reorder_level
        ):

            notification = Notification(
                title="Low Stock Alert",
                message=f"{product.product_name} stock is low",
                type="warning"
            )

            db.add(notification)

        db.commit()

        logger.info(
            f"Inventory created successfully: {new_inventory.id}"
        )

        return new_inventory

    except HTTPException:
        raise

    except Exception as e:

        db.rollback()

        logger.error(
            f"Error creating inventory: {str(e)}",
            exc_info=True
        )

        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )


# GET ALL INVENTORY
@router.get(
    "/",
    response_model=list[InventoryResponse]
)
def get_inventory(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    inventory = db.query(Inventory).all()

    return inventory


# GET INVENTORY LOGS
@router.get(
    "/logs",
    response_model=list[InventoryLogResponse]
)
def get_inventory_logs(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    logs = db.query(InventoryLog).all()

    return logs


# GET SINGLE INVENTORY
@router.get(
    "/{inventory_id}",
    response_model=InventoryResponse
)
def get_single_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        raise HTTPException(
            status_code=404,
            detail="Inventory not found"
        )

    return inventory


# UPDATE INVENTORY
@router.put(
    "/{inventory_id}",
    response_model=InventoryResponse
)
def update_inventory(
    inventory_id: int,
    updated_data: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_staff)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        raise HTTPException(
            status_code=404,
            detail="Inventory not found"
        )

    # RESERVED VALIDATION
    if (
        updated_data.quantity is not None
        and updated_data.quantity_reserved is not None
        and updated_data.quantity_reserved > updated_data.quantity
    ):

        raise HTTPException(
            status_code=400,
            detail="Reserved quantity cannot exceed total quantity"
        )

    old_qty = inventory.quantity

    if updated_data.quantity is not None:
        inventory.quantity = updated_data.quantity

    if updated_data.quantity_reserved is not None:
        inventory.quantity_reserved = updated_data.quantity_reserved

    # CREATE LOG
    log = InventoryLog(
        product_id=inventory.product_id,
        warehouse_id=inventory.warehouse_id,
        old_quantity=old_qty,
        new_quantity=inventory.quantity,
        quantity_changed=abs(
            inventory.quantity - old_qty
        ),
        action="UPDATE"
    )

    db.add(log)

    # LOW STOCK ALERT
    product = db.query(Product).filter(
        Product.id == inventory.product_id
    ).first()

    if (
        product.reorder_level is not None
        and inventory.quantity <= product.reorder_level
    ):

        notification = Notification(
            title="Low Stock Alert",
            message=f"{product.product_name} stock is low",
            type="warning"
        )

        db.add(notification)

    try:

        db.commit()

        db.refresh(inventory)

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    return inventory


# DELETE INVENTORY
@router.delete("/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        raise HTTPException(
            status_code=404,
            detail="Inventory not found"
        )

    db.delete(inventory)

    db.commit()

    return {
        "message": "Inventory deleted successfully"
    }