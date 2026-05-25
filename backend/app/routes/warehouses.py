from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app.models.warehouse import Warehouse
from app.models.user import User
from app.models.inventory import Inventory
from app.models.purchase_order import PurchaseOrder
from app.schemas.warehouse_schema import WarehouseCreate, WarehouseUpdate, WarehouseResponse

router = APIRouter(
    prefix="/warehouses",
    tags=["Warehouses"]
)

@router.post("/", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(warehouse_in: WarehouseCreate, db: Session = Depends(get_db)):
    # Validate manager_id if provided
    if warehouse_in.manager_id is not None:
        manager = db.query(User).filter(User.id == warehouse_in.manager_id).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User (Manager) with id {warehouse_in.manager_id} does not exist."
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

@router.get("/", response_model=List[WarehouseResponse])
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

@router.get("/{id}", response_model=WarehouseResponse)
def get_warehouse(id: int, db: Session = Depends(get_db)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )
    return warehouse

@router.put("/{id}", response_model=WarehouseResponse)
def update_warehouse(id: int, warehouse_in: WarehouseUpdate, db: Session = Depends(get_db)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )
        
    if warehouse_in.manager_id is not None:
        manager = db.query(User).filter(User.id == warehouse_in.manager_id).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User (Manager) with id {warehouse_in.manager_id} does not exist."
            )
            
    update_data = warehouse_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(warehouse, key, value)
        
    db.commit()
    db.refresh(warehouse)
    return warehouse

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(id: int, db: Session = Depends(get_db)):
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {id} not found."
        )
        
    # Check if warehouse has associated inventory
    inventory_exists = db.query(Inventory).filter(Inventory.warehouse_id == id).first()
    if inventory_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete warehouse with associated inventory."
        )
        
    # Check if warehouse has associated purchase orders
    po_exists = db.query(PurchaseOrder).filter(PurchaseOrder.warehouse_id == id).first()
    if po_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete warehouse with associated purchase orders."
        )
        
    db.delete(warehouse)
    db.commit()
    return None
