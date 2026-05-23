from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.inventory import Inventory
from app.schemas.inventory_schema import (
    InventoryCreate,
    InventoryResponse
)

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

    new_inventory = Inventory(
        product_id=inventory.product_id,
        warehouse_id=inventory.warehouse_id,
        quantity_available=inventory.quantity_available,
        quantity_reserved=inventory.quantity_reserved
    )

    db.add(new_inventory)

    db.commit()

    db.refresh(new_inventory)

    return new_inventory


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

    inventory.quantity_available = updated_data.quantity_available

    inventory.quantity_reserved = updated_data.quantity_reserved

    db.commit()

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