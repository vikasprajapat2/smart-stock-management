from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database import get_db
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder
from app.schemas.supplier_schema import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"]
)

@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_in: SupplierCreate, db: Session = Depends(get_db)):
    # Check if supplier with same email already exists (if email is provided)
    if supplier_in.email:
        existing = db.query(Supplier).filter(Supplier.email == supplier_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with email '{supplier_in.email}' already exists."
            )
            
    supplier = Supplier(
        supplier_name=supplier_in.supplier_name,
        contact_name=supplier_in.contact_name,
        email=supplier_in.email,
        phone=supplier_in.phone,
        address=supplier_in.address,
        is_active=supplier_in.is_active if supplier_in.is_active is not None else True
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.get("/", response_model=List[SupplierResponse])
def get_suppliers(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Supplier)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Supplier.supplier_name.ilike(search_filter),
                Supplier.contact_name.ilike(search_filter),
                Supplier.email.ilike(search_filter)
            )
        )
    return query.all()

@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
    return supplier

@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(id: int, supplier_in: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
        
    if supplier_in.email is not None and supplier_in.email != supplier.email:
        existing = db.query(Supplier).filter(Supplier.email == supplier_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with email '{supplier_in.email}' already exists."
            )
            
    update_data = supplier_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(supplier, key, value)
        
    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
        
    # Check if supplier has associated purchase orders
    po_exists = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == id).first()
    if po_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete supplier with associated purchase orders."
        )
        
    db.delete(supplier)
    db.commit()
    return None

# Import inside endpoint or function to avoid circular dependencies if any
@router.get("/{id}/history")
def get_supplier_history(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
    
    # Retrieve purchase orders
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == id).all()
    # We can format the history to return PO details with items
    result = []
    for po in pos:
        items = []
        for item in po.items:
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.product_name if item.product else None,
                "sku": item.product.sku if item.product else None,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "total_price": float(item.quantity * item.unit_price)
            })
        result.append({
            "id": po.id,
            "po_number": po.po_number,
            "status": po.status,
            "order_date": po.order_date,
            "delivery_date": po.delivery_date,
            "total_amount": float(po.total_amount),
            "warehouse_name": po.warehouse.warehouse_name if po.warehouse else None,
            "items": items
        })
    return result
