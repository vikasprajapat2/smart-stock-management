from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models.production_order import ProductionOrder
from app.models.product import Product
from app.models.bom import BOM
from app.schemas.production_order_schema import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderResponse,
    StockAvailabilityResponse
)
from app.utils.role_checker import require_staff, require_admin
from app.utils.bom_helpers import (
    check_stock_availability,
    reserve_stock_for_production,
    release_reservations_and_consume_stock
)

router = APIRouter(
    prefix="/production-orders",
    tags=["Production Orders"]
)

@router.post("/", response_model=ProductionOrderResponse, status_code=status.HTTP_201_CREATED)
def create_production_order(
    order_in: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    # Check product
    prod = db.query(Product).filter(Product.id == order_in.product_id).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {order_in.product_id} not found."
        )

    # Check BOM
    bom = db.query(BOM).filter(BOM.id == order_in.bom_id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {order_in.bom_id} not found."
        )

    if bom.product_id != order_in.product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected BOM does not belong to product with id {order_in.product_id}."
        )

    # Check unique production order number
    existing = db.query(ProductionOrder).filter(
        ProductionOrder.production_order_number == order_in.production_order_number
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Production order with number '{order_in.production_order_number}' already exists."
        )

    order = ProductionOrder(
        production_order_number=order_in.production_order_number,
        product_id=order_in.product_id,
        bom_id=order_in.bom_id,
        quantity_to_produce=order_in.quantity_to_produce,
        status="DRAFT"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.get("/", response_model=List[ProductionOrderResponse])
def list_production_orders(db: Session = Depends(get_db)):
    return db.query(ProductionOrder).all()

@router.get("/{id}", response_model=ProductionOrderResponse)
def get_production_order(id: int, db: Session = Depends(get_db)):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production order with id {id} not found."
        )
    return order

@router.get("/{id}/check-availability", response_model=StockAvailabilityResponse)
def check_availability_endpoint(id: int, db: Session = Depends(get_db)):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production order with id {id} not found."
        )
    return check_stock_availability(db, order)

@router.post("/{id}/approve", response_model=ProductionOrderResponse)
def approve_production_order(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production order with id {id} not found."
        )

    if order.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only DRAFT production orders can be approved. Current status: {order.status}."
        )

    # Run reservation
    reserve_stock_for_production(db, order)

    order.status = "APPROVED"
    db.commit()
    db.refresh(order)
    return order

@router.post("/{id}/start", response_model=ProductionOrderResponse)
def start_production_order(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production order with id {id} not found."
        )

    if order.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only APPROVED production orders can be started. Current status: {order.status}."
        )

    order.status = "IN_PRODUCTION"
    db.commit()
    db.refresh(order)
    return order

@router.post("/{id}/complete", response_model=ProductionOrderResponse)
def complete_production_order(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    order = db.query(ProductionOrder).filter(ProductionOrder.id == id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Production order with id {id} not found."
        )

    if order.status not in ["APPROVED", "IN_PRODUCTION"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Production order must be APPROVED or IN_PRODUCTION to complete. Current status: {order.status}."
        )

    # Consume raw materials and add finished product stock
    release_reservations_and_consume_stock(db, order)

    order.status = "COMPLETED"
    db.commit()
    db.refresh(order)
    return order
