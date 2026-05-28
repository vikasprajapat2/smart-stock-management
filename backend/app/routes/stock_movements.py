from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging
from typing import Optional

from app.database import get_db
from app.models.stock_movement import StockMovement
from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.notification import Notification
from app.models.user import User

from app.schemas.stock_movement_schema import (
    StockMovementCreate,
    StockMovementResponse,
    StockTransferCreate
)

from app.utils.role_checker import require_staff
from app.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stock-movements",
    tags=["Stock Movements"]
)


@router.post("/in", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def stock_in(
    payload: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    try:
        # Validate product
        product = db.query(Product).filter(Product.id == payload.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Validate warehouse
        warehouse = db.query(Warehouse).filter(Warehouse.id == payload.warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

        # Get or create inventory
        inventory = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id,
            Inventory.warehouse_id == payload.warehouse_id
        ).first()

        old_qty = 0
        if not inventory:
            inventory = Inventory(
                product_id=payload.product_id,
                warehouse_id=payload.warehouse_id,
                quantity=payload.quantity,
                quantity_reserved=0
            )
            db.add(inventory)
        else:
            old_qty = inventory.quantity
            inventory.quantity += payload.quantity

        new_qty = inventory.quantity

        # Create stock movement
        movement = StockMovement(
            product_id=payload.product_id,
            warehouse_id=payload.warehouse_id,
            movement_type="IN",
            quantity=payload.quantity,
            reference=payload.reference,
            remarks=payload.remarks,
            created_by=current_user.id
        )
        db.add(movement)

        # Create inventory log
        log = InventoryLog(
            product_id=payload.product_id,
            warehouse_id=payload.warehouse_id,
            old_quantity=old_qty,
            new_quantity=new_qty,
            quantity_changed=payload.quantity,
            action="STOCK_IN"
        )
        db.add(log)

        # Commit changes
        db.commit()
        db.refresh(movement)
        
        return movement

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in stock IN: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post("/out", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def stock_out(
    payload: StockMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    try:
        # Validate product
        product = db.query(Product).filter(Product.id == payload.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Validate warehouse
        warehouse = db.query(Warehouse).filter(Warehouse.id == payload.warehouse_id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Warehouse not found")

        # Get inventory
        inventory = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id,
            Inventory.warehouse_id == payload.warehouse_id
        ).first()

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Inventory not found for this product and warehouse"
            )

        # Check stock cannot go below 0
        if inventory.quantity < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient stock: quantity cannot go below 0"
            )

        # Reserved stock validation
        available_qty = inventory.quantity - inventory.quantity_reserved
        if available_qty < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient available stock. Total: {inventory.quantity}, Reserved: {inventory.quantity_reserved}, Available: {available_qty}, Requested: {payload.quantity}"
            )

        old_qty = inventory.quantity
        inventory.quantity -= payload.quantity
        new_qty = inventory.quantity

        # Create stock movement
        movement = StockMovement(
            product_id=payload.product_id,
            warehouse_id=payload.warehouse_id,
            movement_type="OUT",
            quantity=payload.quantity,
            reference=payload.reference,
            remarks=payload.remarks,
            created_by=current_user.id
        )
        db.add(movement)

        # Create inventory log
        log = InventoryLog(
            product_id=payload.product_id,
            warehouse_id=payload.warehouse_id,
            old_quantity=old_qty,
            new_quantity=new_qty,
            quantity_changed=payload.quantity,
            action="STOCK_OUT"
        )
        db.add(log)

        # Low Stock Alert
        if (
            product.reorder_level is not None
            and new_qty <= product.reorder_level
        ):
            notification = Notification(
                title="Low Stock Alert",
                message=f"{product.product_name} stock is low in {warehouse.warehouse_name}",
                type="warning"
            )
            db.add(notification)

        db.commit()
        db.refresh(movement)
        
        return movement

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in stock OUT: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.post("/transfer", response_model=list[StockMovementResponse], status_code=status.HTTP_201_CREATED)
def stock_transfer(
    payload: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    try:
        # Validate product
        product = db.query(Product).filter(Product.id == payload.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Validate source warehouse
        src_warehouse = db.query(Warehouse).filter(Warehouse.id == payload.source_warehouse_id).first()
        if not src_warehouse:
            raise HTTPException(status_code=404, detail="Source warehouse not found")

        # Validate destination warehouse
        dest_warehouse = db.query(Warehouse).filter(Warehouse.id == payload.destination_warehouse_id).first()
        if not dest_warehouse:
            raise HTTPException(status_code=404, detail="Destination warehouse not found")

        if payload.source_warehouse_id == payload.destination_warehouse_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and destination warehouses must be different"
            )

        # Get source inventory
        src_inventory = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id,
            Inventory.warehouse_id == payload.source_warehouse_id
        ).first()

        if not src_inventory:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No inventory found in source warehouse for this product"
            )

        # Check stock cannot go below 0 at source
        if src_inventory.quantity < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient stock in source warehouse: quantity cannot go below 0"
            )

        # Reserved stock validation at source
        available_qty = src_inventory.quantity - src_inventory.quantity_reserved
        if available_qty < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient available stock in source warehouse. Total: {src_inventory.quantity}, Reserved: {src_inventory.quantity_reserved}, Available: {available_qty}, Requested: {payload.quantity}"
            )

        # Get or create destination inventory
        dest_inventory = db.query(Inventory).filter(
            Inventory.product_id == payload.product_id,
            Inventory.warehouse_id == payload.destination_warehouse_id
        ).first()

        dest_old_qty = 0
        if not dest_inventory:
            dest_inventory = Inventory(
                product_id=payload.product_id,
                warehouse_id=payload.destination_warehouse_id,
                quantity=payload.quantity,
                quantity_reserved=0
            )
            db.add(dest_inventory)
        else:
            dest_old_qty = dest_inventory.quantity
            dest_inventory.quantity += payload.quantity

        src_old_qty = src_inventory.quantity
        src_inventory.quantity -= payload.quantity

        src_new_qty = src_inventory.quantity
        dest_new_qty = dest_inventory.quantity

        # Create two stock movement records
        src_movement = StockMovement(
            product_id=payload.product_id,
            warehouse_id=payload.source_warehouse_id,
            movement_type="TRANSFER",
            quantity=-payload.quantity,
            reference=payload.reference,
            remarks=payload.remarks or f"Transfer to warehouse {dest_warehouse.warehouse_name}",
            created_by=current_user.id
        )
        dest_movement = StockMovement(
            product_id=payload.product_id,
            warehouse_id=payload.destination_warehouse_id,
            movement_type="TRANSFER",
            quantity=payload.quantity,
            reference=payload.reference,
            remarks=payload.remarks or f"Transfer from warehouse {src_warehouse.warehouse_name}",
            created_by=current_user.id
        )
        db.add(src_movement)
        db.add(dest_movement)

        # Create two inventory logs
        src_log = InventoryLog(
            product_id=payload.product_id,
            warehouse_id=payload.source_warehouse_id,
            old_quantity=src_old_qty,
            new_quantity=src_new_qty,
            quantity_changed=payload.quantity,
            action="TRANSFER_OUT"
        )
        dest_log = InventoryLog(
            product_id=payload.product_id,
            warehouse_id=payload.destination_warehouse_id,
            old_quantity=dest_old_qty,
            new_quantity=dest_new_qty,
            quantity_changed=payload.quantity,
            action="TRANSFER_IN"
        )
        db.add(src_log)
        db.add(dest_log)

        # Low Stock Alert for source warehouse
        if (
            product.reorder_level is not None
            and src_new_qty <= product.reorder_level
        ):
            notification = Notification(
                title="Low Stock Alert",
                message=f"{product.product_name} stock is low in {src_warehouse.warehouse_name} after transfer",
                type="warning"
            )
            db.add(notification)

        db.commit()
        db.refresh(src_movement)
        db.refresh(dest_movement)

        return [src_movement, dest_movement]

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in stock transfer: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )


@router.get("/", response_model=list[StockMovementResponse])
def get_stock_movements(
    product_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(StockMovement)
    if product_id is not None:
        query = query.filter(StockMovement.product_id == product_id)
    if warehouse_id is not None:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)
    if movement_type is not None:
        query = query.filter(StockMovement.movement_type == movement_type)
    return query.all()


@router.get("/{id}", response_model=StockMovementResponse)
def get_stock_movement_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    movement = db.query(StockMovement).filter(StockMovement.id == id).first()
    if not movement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock movement with id {id} not found"
        )
    return movement
