from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
from app.models.inventory import Inventory
from fastapi import HTTPException

from app.database import get_db
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.warehouse import Warehouse
from app.models.inventory import Inventory
from app.models.notification import Notification
from app.schemas.purchase_order_schema import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
from app.utils.product_helpers import generate_po_number
from app.utils.inventory_helpers import log_inventory_change, check_and_trigger_low_stock_alert
from app.utils.role_checker import require_staff, require_admin
from app.utils.pdf_generator import generate_po_pdf

router = APIRouter(
    prefix="/purchase-orders",
    tags=["Purchase Orders"]
)

@router.post("/", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db)
):
    # Validate supplier exists
    supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Supplier with id {po_in.supplier_id} does not exist."
        )

    # Validate warehouse if provided
    if po_in.warehouse_id is not None:
        warehouse = db.query(Warehouse).filter(Warehouse.id == po_in.warehouse_id).first()
        if not warehouse:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Warehouse with id {po_in.warehouse_id} does not exist."
            )

    # Validate products exist
    for item in po_in.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with id {item.product_id} does not exist."
            )

    # Generate unique PO number
    po_number = None
    for _ in range(5):
        temp_po = generate_po_number()
        existing = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == temp_po).first()
        if not existing:
            po_number = temp_po
            break
    if not po_number:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a unique Purchase Order number."
        )

    # Calculate total amount
    total_amount = sum(item.quantity * item.unit_price for item in po_in.items)

    # Create purchase order
    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=po_in.supplier_id,
        warehouse_id=po_in.warehouse_id,
        status=po_in.status if po_in.status else "PENDING",
        delivery_date=po_in.delivery_date,
        total_amount=total_amount
    )
    db.add(po)
    db.commit()
    db.refresh(po)

    # Add items
    for item in po_in.items:
        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        db.add(po_item)

    db.commit()
    db.refresh(po)

    notification = Notification(
        title="Purchase Order Created",
        message=f"PO {po.po_number} created for {supplier.supplier_name}.",
        type="info"
    )
    db.add(notification)
    db.commit()

    # Populate item fields (product_name, sku) for response schema
    for item in po.items:
        item.product_name = item.product.product_name if item.product else None
        item.sku = item.product.sku if item.product else None

    return po

@router.get("/", response_model=List[PurchaseOrderResponse])
def get_purchase_orders(
    supplier_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PurchaseOrder)
    
    if supplier_id is not None:
        query = query.filter(PurchaseOrder.supplier_id == supplier_id)
        
    if status:
        query = query.filter(PurchaseOrder.status.ilike(status))
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(PurchaseOrder.po_number.ilike(search_filter))
        
    pos = query.all()
    for po in pos:
        for item in po.items:
            item.product_name = item.product.product_name if item.product else None
            item.sku = item.product.sku if item.product else None
            
    return pos

@router.get("/{id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    id: int,
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with id {id} not found."
        )
    for item in po.items:
        item.product_name = item.product.product_name if item.product else None
        item.sku = item.product.sku if item.product else None
        
    return po

@router.put("/{id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    id: int,
    po_in: PurchaseOrderUpdate,
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with id {id} not found."
        )

    # If already COMPLETED, prevent status edits to prevent double inventory incrementing
    if po.status == "COMPLETED" and po_in.status is not None and po_in.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change status of a COMPLETED purchase order."
        )

    # Validate warehouse if updated
    if po_in.warehouse_id is not None and po_in.warehouse_id != po.warehouse_id:
        warehouse = db.query(Warehouse).filter(Warehouse.id == po_in.warehouse_id).first()
        if not warehouse:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Warehouse with id {po_in.warehouse_id} does not exist."
            )

    # Validate supplier if updated
    if po_in.supplier_id is not None and po_in.supplier_id != po.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == po_in.supplier_id).first()
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with id {po_in.supplier_id} does not exist."
            )

    old_status = po.status
    
    # Process items update if provided
    if po_in.items is not None:
        if po.status == "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot modify items of a COMPLETED purchase order."
            )
            
        # Validate that all products exist
        for item in po_in.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Product with id {item.product_id} does not exist."
                )
                
        # Delete old items
        db.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == po.id).delete()
        
        # Add new items
        for item in po_in.items:
            po_item = PurchaseOrderItem(
                purchase_order_id=po.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price
            )
            db.add(po_item)
            
        # Recalculate total amount
        po.total_amount = sum(item.quantity * item.unit_price for item in po_in.items)

    # Update generic fields (excluding items)
    update_data = po_in.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_data.items():
        setattr(po, key, value)
        
    # Check if we are transitioning to COMPLETED
    if po.status == "COMPLETED" and old_status != "COMPLETED":
        # Must have warehouse_id to update inventory
        effective_warehouse_id = po_in.warehouse_id if po_in.warehouse_id is not None else po.warehouse_id
        if effective_warehouse_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase order must be assigned to a warehouse before it can be COMPLETED."
            )
            
        # Process items to update/create inventory records
        for item in po.items:
            inventory_record = db.query(Inventory).filter(
                Inventory.product_id == item.product_id,
                Inventory.warehouse_id == effective_warehouse_id
            ).first()
            
            if inventory_record:
                inventory_record.quantity += item.quantity
            else:
                new_inventory = Inventory(
                    product_id=item.product_id,
                    warehouse_id=effective_warehouse_id,
                    quantity=item.quantity,
                    quantity_reserved=0
                )
                db.add(new_inventory)

    db.commit()
    db.refresh(po)
    
    for item in po.items:
        item.product_name = item.product.product_name if item.product else None
        item.sku = item.product.sku if item.product else None
        
    return po

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    id: int,
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with id {id} not found."
        )
        
    if po.status == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a COMPLETED purchase order."
        )
        
    db.delete(po)
    db.commit()
    return None
@router.get("/{id}/pdf")
def get_purchase_order_pdf(
    id: int,
    db: Session = Depends(get_db)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order with id {id} not found."
        )
        
    try:
        pdf_bytes = generate_po_pdf(po)
        headers = {
            "Content-Disposition": f'inline; filename="PO_{po.po_number}.pdf"'
        }
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating PDF: {str(e)}"
        )

# RECEIVE PURCHASE ORDER
@router.put("/{po_id}/receive")
def receive_purchase_order(
    po_id: int,
    db: Session = Depends(get_db)
):

    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id
    ).first()

    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )

    if po.status == "RECEIVED":
        raise HTTPException(
            status_code=400,
            detail="Purchase order already received"
        )

    for item in po.items:

        inventory = db.query(Inventory).filter(
            Inventory.product_id == item.product_id,
            Inventory.warehouse_id == po.warehouse_id
        ).first()

        if inventory:

            inventory.quantity += item.quantity

        else:

            inventory = Inventory(
                product_id=item.product_id,
                warehouse_id=po.warehouse_id,
                quantity=item.quantity,
                quantity_reserved=0
            )

            db.add(inventory)

    po.status = "RECEIVED"

    db.commit()

    return {
        "message": "Purchase order received successfully"
    }
