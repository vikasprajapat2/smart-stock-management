from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.purchase_request import PurchaseRequest
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.supplier import Supplier
from app.models.warehouse import Warehouse
from app.models.product import Product
from app.schemas.purchase_request_schema import PurchaseRequestResponse
from app.schemas.purchase_order_schema import PurchaseOrderResponse
from app.utils.product_helpers import generate_po_number
from app.utils.role_checker import require_staff

router = APIRouter(
    prefix="/purchase-requests",
    tags=["Purchase Requests"]
)

class CreatePOFromPRRequest(BaseModel):
    supplier_id: int
    warehouse_id: Optional[int] = None

@router.get("/", response_model=List[PurchaseRequestResponse])
def list_purchase_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(PurchaseRequest)
    if status:
        query = query.filter(PurchaseRequest.status == status)
    return query.all()

@router.post("/{id}/create-po", response_model=PurchaseOrderResponse)
def create_po_from_pr(
    id: int,
    req_in: CreatePOFromPRRequest,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    # Find purchase request
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == id).first()
    if not pr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase request with id {id} not found."
        )

    if pr.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Purchase request is not in PENDING state. Current status: {pr.status}."
        )

    # Validate supplier
    supplier = db.query(Supplier).filter(Supplier.id == req_in.supplier_id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Supplier with id {req_in.supplier_id} not found."
        )

    # Validate warehouse if specified
    if req_in.warehouse_id:
        wh = db.query(Warehouse).filter(Warehouse.id == req_in.warehouse_id).first()
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Warehouse with id {req_in.warehouse_id} not found."
            )

    # Validate product exists
    product = db.query(Product).filter(Product.id == pr.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product associated with the PR not found."
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

    # Create PO
    unit_price = product.selling_price or 0.00
    total_amount = pr.quantity_required * unit_price

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=req_in.supplier_id,
        warehouse_id=req_in.warehouse_id,
        status="PENDING",
        total_amount=total_amount
    )
    db.add(po)
    db.flush()

    # Create PO item
    po_item = PurchaseOrderItem(
        purchase_order_id=po.id,
        product_id=pr.product_id,
        quantity=int(pr.quantity_required),
        unit_price=unit_price
    )
    db.add(po_item)

    # Update PR status
    pr.status = "PO_CREATED"
    
    db.commit()
    db.refresh(po)

    # Populate items response fields for validation
    for item in po.items:
        item.product_name = item.product.product_name if item.product else None
        item.sku = item.product.sku if item.product else None

    return po
