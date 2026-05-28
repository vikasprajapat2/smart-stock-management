from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from sqlalchemy.orm import Session

from sqlalchemy import or_

from typing import List, Optional

from app.database import get_db

from app.models.warehouse import Warehouse

from app.models.user import User

from app.models.inventory import Inventory

from app.models.purchase_order import PurchaseOrder

from app.schemas.warehouse_schema import (
    WarehouseCreate,
    WarehouseUpdate,
    WarehouseResponse
)

router = APIRouter(
    prefix="/warehouses",
    tags=["Warehouses"]
)


# CREATE WAREHOUSE
@router.post(
    "/",
    response_model=WarehouseResponse,
    status_code=status.HTTP_201_CREATED
)
def create_warehouse(
    warehouse_in: WarehouseCreate,
    db: Session = Depends(get_db)
):

    # CHECK DUPLICATE
    existing = db.query(Warehouse).filter(
        Warehouse.warehouse_name == warehouse_in.warehouse_name
    ).first()

    if existing:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Warehouse already exists."
        )

    # VALIDATE MANAGER
    if warehouse_in.manager_id is not None:

        manager = db.query(User).filter(
            User.id == warehouse_in.manager_id
        ).first()

        if not manager:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Manager with id {warehouse_in.manager_id} not found."
            )

    warehouse = Warehouse(
        warehouse_name=warehouse_in.warehouse_name,
        location=warehouse_in.location,
        manager_id=warehouse_in.manager_id
    )

    db.add(warehouse)

    db.commit()

    db.refresh(warehouse)

    return warehouse


# GET ALL WAREHOUSES
@router.get(
    "/",
    response_model=List[WarehouseResponse]
)
def get_warehouses(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):

    query = db.query(Warehouse)

    if search:

        search_filter = f"%{search}%"

        query = query.filter(
            or_(
                Warehouse.warehouse_name.ilike(search_filter),
                Warehouse.location.ilike(search_filter)
            )
        )

    return query.all()


# GET SINGLE WAREHOUSE
@router.get(
    "/{id}",
    response_model=WarehouseResponse
)
def get_warehouse(
    id: int,
    db: Session = Depends(get_db)
):

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == id
    ).first()

    if not warehouse:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )

    return warehouse


# UPDATE WAREHOUSE
@router.put(
    "/{id}",
    response_model=WarehouseResponse
)
def update_warehouse(
    id: int,
    warehouse_in: WarehouseUpdate,
    db: Session = Depends(get_db)
):

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == id
    ).first()

    if not warehouse:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )

    # VALIDATE MANAGER
    if warehouse_in.manager_id is not None:

        manager = db.query(User).filter(
            User.id == warehouse_in.manager_id
        ).first()

        if not manager:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Manager with id {warehouse_in.manager_id} not found."
            )

    update_data = warehouse_in.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():

        setattr(warehouse, key, value)

    db.commit()

    db.refresh(warehouse)

    return warehouse


# DELETE WAREHOUSE
@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_warehouse(
    id: int,
    db: Session = Depends(get_db)
):

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == id
    ).first()

    if not warehouse:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )

    # CHECK INVENTORY
    inventory_exists = db.query(Inventory).filter(
        Inventory.warehouse_id == id
    ).first()

    if inventory_exists:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete warehouse with inventory."
        )

    # CHECK PURCHASE ORDERS
    po_exists = db.query(PurchaseOrder).filter(
        PurchaseOrder.warehouse_id == id
    ).first()

    if po_exists:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete warehouse with purchase orders."
        )

    db.delete(warehouse)

    db.commit()

    return None


# WAREHOUSE INVENTORY
@router.get("/{id}/inventory")
def warehouse_inventory(
    id: int,
    db: Session = Depends(get_db)
):

    warehouse = db.query(Warehouse).filter(
        Warehouse.id == id
    ).first()

    if not warehouse:

        raise HTTPException(
            status_code=404,
            detail="Warehouse not found."
        )

    inventory_items = db.query(Inventory).filter(
        Inventory.warehouse_id == id
    ).all()

    result = []

    for item in inventory_items:

        result.append({
            "product_id": item.product_id,
            "quantity": item.quantity,
            "reserved_quantity": item.quantity_reserved
        })

    return {
        "warehouse": warehouse.warehouse_name,
        "inventory": result
    }