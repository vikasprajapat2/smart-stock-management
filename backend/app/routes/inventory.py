from fastapi import APIRouter, Depends, HTTPException
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

        db.commit()

        db.refresh(new_inventory)

        # LOW STOCK CHECK
        print(product.reorder_level)

        print(new_inventory.quantity)

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

            print("LOW STOCK NOTIFICATION CREATED")

        logger.info(f"Created inventory: {new_inventory.id}")

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
@router.get("/")
def get_inventory(
    db: Session = Depends(get_db)
):

    inventory = db.query(Inventory).all()

    return inventory


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

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        return {"message": "Inventory not found"}

    inventory.product_id = updated_data.product_id

    inventory.warehouse_id = updated_data.warehouse_id

    inventory.quantity = updated_data.quantity_available

    inventory.quantity_reserved = updated_data.quantity_reserved

    try:

        db.commit()

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    return {"message": "Inventory updated successfully"}


# DELETE INVENTORY
@router.delete("/{inventory_id}")
def delete_inventory(
    inventory_id: int,
    db: Session = Depends(get_db)
):

    inventory = db.query(Inventory).filter(
        Inventory.id == inventory_id
    ).first()

    if not inventory:

        return {"message": "Inventory not found"}

    db.delete(inventory)

    db.commit()

    return {"message": "Inventory deleted successfully"}