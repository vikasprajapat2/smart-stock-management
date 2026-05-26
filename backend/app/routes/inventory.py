from fastapi import APIRouter, Depends, HTTPException
from app.utils.role_checker import (
    require_admin,
    require_staff
)
from sqlalchemy.orm import Session
import logging

from app.database import SessionLocal
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.notification import Notification

from app.schemas.inventory_schema import (
    InventoryCreate,
    InventoryResponse
)
from app.utils.auth_middleware import get_current_user
from app.utils.inventory_helpers import log_inventory_change, check_and_trigger_low_stock_alert

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
@router.post("/", response_model=InventoryResponse)
def create_inventory(
    inventory: InventoryCreate,
    db: Session = Depends(get_db)
):

    try:
        # CHECK PRODUCT EXISTS
        product = db.query(Product).filter(
            Product.id == inventory.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=400,
                detail=f"Product with id {inventory.product_id} not found"
            )

        # CHECK WAREHOUSE EXISTS
        warehouse = db.query(Warehouse).filter(
            Warehouse.id == inventory.warehouse_id
        ).first()

        if not warehouse:
            raise HTTPException(
                status_code=400,
                detail=f"Warehouse with id {inventory.warehouse_id} not found"
            )

        # CREATE INVENTORY
        new_inventory = Inventory(
            product_id=inventory.product_id,
            warehouse_id=inventory.warehouse_id,
            quantity=inventory.quantity_available,
            quantity_reserved=inventory.quantity_reserved
        )

        db.add(new_inventory)
        db.flush()

        # LOG INVENTORY CHANGE
        log_inventory_change(
            db=db,
            product_id=inventory.product_id,
            old_qty=0,
            new_qty=inventory.quantity_available,
            action="MANUAL_CREATE"
        )

        # CHECK AND TRIGGER LOW STOCK ALERT
        check_and_trigger_low_stock_alert(
            db=db,
            product_id=inventory.product_id,
            warehouse_id=inventory.warehouse_id,
            quantity=inventory.quantity_available
        )

        db.commit()
        db.refresh(new_inventory)

        logger.info(f"Created inventory: {new_inventory.id}")
        return new_inventory

    except HTTPException as he:
        db.rollback()
        raise he

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
@router.get("/")
def get_inventory(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):

    inventory = db.query(Inventory).all()

    return inventory


# GET LOW STOCK INVENTORY
@router.get("/low-stock")
def get_low_stock_inventory(
    db: Session = Depends(get_db)
):
    results = db.query(Inventory).join(Product).filter(
        Product.reorder_level.isnot(None),
        Inventory.quantity <= Product.reorder_level
    ).all()
    return results


# GET INVENTORY BY WAREHOUSE
@router.get("/warehouse/{id}")
def get_inventory_by_warehouse(
    id: int,
    db: Session = Depends(get_db)
):
    results = db.query(Inventory).filter(
        Inventory.warehouse_id == id
    ).all()
    return results


# GET INVENTORY LOGS
@router.get("/logs")
def get_inventory_logs(
    db: Session = Depends(get_db)
):
    results = db.query(InventoryLog).order_by(InventoryLog.timestamp.desc()).all()
    logs = []
    for log in results:
        logs.append({
            "id": log.id,
            "product_id": log.product_id,
            "product_name": log.product.product_name if log.product else "Unknown Product",
            "old_quantity": log.old_quantity,
            "new_quantity": log.new_quantity,
            "action": log.action,
            "timestamp": log.timestamp
        })
    return logs


# GET SINGLE INVENTORY
@router.get("/{inventory_id}")
def get_single_inventory(
    inventory_id: int,
    db: Session = Depends(get_db)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    return inventory


# UPDATE INVENTORY
@router.put("/{inventory_id}")
def update_inventory(
    inventory_id: int,
    updated_data: InventoryCreate,
    db: Session = Depends(get_db)
):

    try:
        inventory = db.query(Inventory).filter(
            Inventory.id == inventory_id
        ).first()

        if not inventory:
            raise HTTPException(status_code=404, detail="Inventory not found")

        old_qty = inventory.quantity

        inventory.product_id = updated_data.product_id
        inventory.warehouse_id = updated_data.warehouse_id
        inventory.quantity = updated_data.quantity_available
        inventory.quantity_reserved = updated_data.quantity_reserved
       
        # Log inventory change
        log_inventory_change(
            db=db,
            product_id=inventory.product_id,
            old_qty=old_qty,
            new_qty=updated_data.quantity_available,
            action="MANUAL_UPDATE"
        )

        # Check and trigger low stock alert
        check_and_trigger_low_stock_alert(
            db=db,
            product_id=inventory.product_id,
            warehouse_id=inventory.warehouse_id,
            quantity=updated_data.quantity_available
        )

        db.commit()
        return {"message": "Inventory updated successfully"}

    except HTTPException as he:
        db.rollback()
        raise he

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# DELETE INVENTORY
@router.delete("/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        return {"message": "Inventory not found"}

    db.delete(inventory)

    db.commit()

    return {"message": "Inventory deleted successfully"}