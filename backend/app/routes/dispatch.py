from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List

from app.database import get_db
from app.models.dispatch import Dispatch, DispatchItem
from app.models.order import SalesOrder
from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog
from app.schemas.dispatch_schema import DispatchCreate, DispatchResponse

router = APIRouter(prefix="/dispatch", tags=["Dispatch"])

@router.post("/", response_model=DispatchResponse, status_code=status.HTTP_201_CREATED)
def create_dispatch(dispatch_data: DispatchCreate, db: Session = Depends(get_db)):
    # Verify sales order exists
    so = db.query(SalesOrder).filter(SalesOrder.id == dispatch_data.sales_order_id).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
        
    if so.status not in ["APPROVED", "PARTIAL_PRODUCTION", "READY_FOR_DISPATCH"]:
        raise HTTPException(status_code=400, detail=f"Cannot dispatch sales order in {so.status} status")

    # Check inventory and deduct
    for item in dispatch_data.items:
        # Sum total available inventory for this product
        available_stock = db.query(func.sum(Inventory.quantity)).filter(
            Inventory.product_id == item.product_id
        ).scalar() or 0
        
        if available_stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient inventory for product {item.product_id}")
            
        # Deduct from actual inventory records (LIFO/FIFO simplified)
        qty_to_deduct = item.quantity
        inv_records = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.quantity > 0
        ).order_by(Inventory.created_at).all()
        
        for inv in inv_records:
            if qty_to_deduct <= 0:
                break
            if inv.quantity >= qty_to_deduct:
                inv.quantity -= qty_to_deduct
                
                # Log inventory movement
                log = InventoryLog(
                    product_id=inv.product_id,
                    warehouse_id=inv.warehouse_id,
                    action="DISPATCH",
                    quantity_changed=-qty_to_deduct,
                    remarks=f"Dispatched for SO {so.sales_order_number}"
                )
                db.add(log)
                qty_to_deduct = 0
            else:
                qty_to_deduct -= inv.quantity
                log = InventoryLog(
                    product_id=inv.product_id,
                    warehouse_id=inv.warehouse_id,
                    action="DISPATCH",
                    quantity_changed=-inv.quantity,
                    remarks=f"Dispatched for SO {so.sales_order_number}"
                )
                db.add(log)
                inv.quantity = 0

    # Create dispatch record
    new_dispatch = Dispatch(
        dispatch_number=dispatch_data.dispatch_number,
        sales_order_id=dispatch_data.sales_order_id,
        remarks=dispatch_data.remarks
    )
    db.add(new_dispatch)
    db.commit()
    db.refresh(new_dispatch)
    
    for item in dispatch_data.items:
        new_item = DispatchItem(
            dispatch_id=new_dispatch.id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(new_item)
    
    db.commit()
    db.refresh(new_dispatch)
    
    # Check if SO should be marked COMPLETED or stays in READY_FOR_DISPATCH 
    # (Simplified: we'll just mark COMPLETED for this POC)
    so.status = "COMPLETED"
    db.commit()
    
    return new_dispatch

@router.get("/", response_model=List[DispatchResponse])
def get_dispatches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Dispatch).offset(skip).limit(limit).all()

@router.get("/{dispatch_id}", response_model=DispatchResponse)
def get_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    dispatch = db.query(Dispatch).filter(Dispatch.id == dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch
