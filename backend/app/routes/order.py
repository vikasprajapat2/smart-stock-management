from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List
import uuid

from app.database import get_db
from app.models.order import SalesOrder
from app.models.order_item import SalesOrderItem
from app.models.inventory import Inventory
from app.models.production_order import ProductionOrder
from app.models.bom import BOM
from app.schemas.order_schema import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse

router = APIRouter(prefix="/sales-orders", tags=["Sales Orders"])

@router.post("/", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
def create_sales_order(order: SalesOrderCreate, db: Session = Depends(get_db)):
    db_order = SalesOrder(
        sales_order_number=order.sales_order_number,
        customer_id=order.customer_id,
        order_date=order.order_date,
        expected_delivery_date=order.expected_delivery_date,
        remarks=order.remarks,
        status="DRAFT",
        total_amount=order.total_amount
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    for item in order.items:
        db_item = SalesOrderItem(
            sales_order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            rate=item.rate,
            total=item.total
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[SalesOrderResponse])
def get_sales_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(SalesOrder).offset(skip).limit(limit).all()

@router.get("/{order_id}", response_model=SalesOrderResponse)
def get_sales_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    return order

@router.post("/{order_id}/approve", response_model=SalesOrderResponse)
def approve_sales_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(SalesOrder).filter(SalesOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    
    if order.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot approve order in {order.status} status")
    
    # Stock Check Engine & Auto Production Order Creation
    for item in order.items:
        # Check current stock across all warehouses
        stock = db.query(func.sum(Inventory.quantity)).filter(Inventory.product_id == item.product_id).scalar() or 0
        
        if stock < item.quantity:
            shortage = item.quantity - stock
            
            # Check if BOM exists for this product
            bom = db.query(BOM).filter(BOM.product_id == item.product_id).first()
            if bom:
                # Create Production Order
                po_number = f"PO-AUTO-{str(uuid.uuid4())[:8].upper()}"
                prod_order = ProductionOrder(
                    production_order_number=po_number,
                    product_id=item.product_id,
                    bom_id=bom.id,
                    quantity_to_produce=shortage,
                    status="DRAFT",
                    priority="HIGH",
                    sales_order_id=order.id
                )
                db.add(prod_order)
    
    order.status = "APPROVED"
    db.commit()
    db.refresh(order)
    return order