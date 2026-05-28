from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal

from app.database import get_db
from app.models.bom import BOM
from app.models.bom_item import BOMItem
from app.models.product import Product
from app.schemas.bom_schema import BOMCreate, BOMUpdate, BOMResponse, BOMTreeNode
from app.utils.role_checker import require_staff, require_admin
from app.utils.bom_helpers import calculate_bom_cost

router = APIRouter(
    prefix="/boms",
    tags=["BOM (Bill of Materials)"]
)

@router.post("/", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
def create_bom(
    bom_in: BOMCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    # Check if target product exists
    prod = db.query(Product).filter(Product.id == bom_in.product_id).first()
    if not prod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {bom_in.product_id} not found."
        )

    # Check for duplicate BOM number
    existing_bom = db.query(BOM).filter(BOM.bom_number == bom_in.bom_number).first()
    if existing_bom:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"BOM with number '{bom_in.bom_number}' already exists."
        )

    # Create BOM
    bom = BOM(
        bom_number=bom_in.bom_number,
        product_id=bom_in.product_id,
        version=bom_in.version,
        description=bom_in.description,
        labor_cost=bom_in.labor_cost,
        overhead_cost=bom_in.overhead_cost,
        status="DRAFT"
    )
    db.add(bom)
    db.flush()  # Get BOM ID

    # Create items
    for item in bom_in.items:
        material = db.query(Product).filter(Product.id == item.material_product_id).first()
        if not material:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Material product with id {item.material_product_id} not found."
            )
        
        bom_item = BOMItem(
            bom_id=bom.id,
            material_product_id=item.material_product_id,
            quantity_required=item.quantity_required,
            wastage_percent=item.wastage_percent,
            unit=item.unit or material.unit,
            remarks=item.remarks
        )
        db.add(bom_item)

    db.commit()
    db.refresh(bom)
    # Automatically compute cost
    return calculate_bom_cost(db, bom)

@router.get("/", response_model=List[BOMResponse])
def list_boms(db: Session = Depends(get_db)):
    return db.query(BOM).all()

@router.get("/{id}", response_model=BOMResponse)
def get_bom(id: int, db: Session = Depends(get_db)):
    bom = db.query(BOM).filter(BOM.id == id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {id} not found."
        )
    return bom

@router.put("/{id}", response_model=BOMResponse)
def update_bom(
    id: int,
    bom_in: BOMUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff)
):
    bom = db.query(BOM).filter(BOM.id == id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {id} not found."
        )

    # Cannot update approved BOM directly unless reverted or new version created
    if bom.status == "APPROVED" and bom_in.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update an APPROVED BOM. Please change status to DRAFT first or create a new BOM version."
        )

    # Update base fields
    update_data = bom_in.model_dump(exclude_unset=True)
    if "items" in update_data:
        # Recreate items
        db.query(BOMItem).filter(BOMItem.bom_id == id).delete()
        for item in bom_in.items:
            material = db.query(Product).filter(Product.id == item.material_product_id).first()
            if not material:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Material product with id {item.material_product_id} not found."
                )
            bom_item = BOMItem(
                bom_id=id,
                material_product_id=item.material_product_id,
                quantity_required=item.quantity_required,
                wastage_percent=item.wastage_percent,
                unit=item.unit or material.unit,
                remarks=item.remarks
            )
            db.add(bom_item)
        del update_data["items"]

    for key, value in update_data.items():
        setattr(bom, key, value)

    db.commit()
    db.refresh(bom)
    return calculate_bom_cost(db, bom)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    bom = db.query(BOM).filter(BOM.id == id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {id} not found."
        )
    db.delete(bom)
    db.commit()
    return None

@router.post("/{id}/approve", response_model=BOMResponse)
def approve_bom(
    id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    bom = db.query(BOM).filter(BOM.id == id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {id} not found."
        )
    
    bom.status = "APPROVED"
    bom.approved_by_id = current_user.id
    
    # Save a record in BOMVersion history
    from app.models.bom_version import BOMVersion
    version_history = BOMVersion(
        bom_id=bom.id,
        version_number=bom.version,
        revision_notes="BOM Approved",
        approved_by_id=current_user.id
    )
    db.add(version_history)
    
    # Recalculate cost
    calculate_bom_cost(db, bom)
    db.commit()
    db.refresh(bom)
    return bom

@router.get("/{id}/tree", response_model=BOMTreeNode)
def get_bom_tree(id: int, db: Session = Depends(get_db)):
    bom = db.query(BOM).filter(BOM.id == id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {id} not found."
        )

    product = bom.product

    def build_tree_node(prod: Product, qty: Decimal, wastage: Decimal) -> dict:
        # Check if there is an approved BOM for this product
        sub_bom = db.query(BOM).filter(
            BOM.product_id == prod.id,
            BOM.status == "APPROVED"
        ).order_by(BOM.id.desc()).first()

        cost = Decimal(str(prod.selling_price or 0.00)) * qty * (Decimal("1.00") + wastage / Decimal("100.00"))
        
        node = {
            "material_product_id": prod.id,
            "product_name": prod.product_name,
            "sku": prod.sku,
            "quantity_required": qty,
            "unit": prod.unit,
            "wastage_percent": wastage,
            "total_cost": cost,
            "has_sub_bom": sub_bom is not None,
            "sub_bom_id": sub_bom.id if sub_bom else None,
            "children": []
        }

        if sub_bom:
            for item in sub_bom.items:
                child_prod = item.material_product
                child_qty = Decimal(str(item.quantity_required)) * qty
                node["children"].append(build_tree_node(child_prod, child_qty, item.wastage_percent))

        return node

    return build_tree_node(product, Decimal("1.00"), Decimal("0.00"))
