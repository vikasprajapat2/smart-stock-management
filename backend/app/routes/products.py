from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional

from app.database import get_db
from app.models.product import Product
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.warehouse import Warehouse
from app.schemas.product_schema import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductScanRequest,
    ProductScanResponse
)
from app.utils.product_helpers import generate_sku, generate_barcode

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

def get_product_stock(db: Session, product_id: int) -> int:
    qty = db.query(func.sum(Inventory.quantity)).filter(Inventory.product_id == product_id).scalar()
    return qty if qty is not None else 0

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    # Validate category if provided
    category_name = None
    if product_in.category_id:
        category = db.query(Category).filter(Category.id == product_in.category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with id {product_in.category_id} does not exist."
            )
        category_name = category.category_name

    # Handle SKU generation / validation
    sku = product_in.sku
    if not sku:
        # Generate SKU
        for _ in range(5):  # Retry up to 5 times if collisions occur
            temp_sku = generate_sku(product_in.product_name, category_name)
            existing = db.query(Product).filter(Product.sku == temp_sku).first()
            if not existing:
                sku = temp_sku
                break
        if not sku:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate a unique SKU."
            )
    else:
        # Validate uniqueness of provided SKU
        existing = db.query(Product).filter(Product.sku == sku).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{sku}' already exists."
            )

    # Handle Barcode generation / validation
    barcode = product_in.barcode
    if not barcode:
        barcode = generate_barcode()

    product = Product(
        product_name=product_in.product_name,
        sku=sku,
        barcode=barcode,
        category_id=product_in.category_id,
        selling_price=product_in.selling_price,
        reorder_level=product_in.reorder_level,
        unit=product_in.unit,
        is_active=product_in.is_active if product_in.is_active is not None else True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # Set stock_quantity (0 for a newly created product)
    product.stock_quantity = 0
    return product

@router.get("/", response_model=List[ProductResponse])
def get_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Product)
    
    if category_id is not None:
        query = query.filter(Product.category_id == category_id)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Product.product_name.ilike(search_filter),
                Product.sku.ilike(search_filter),
                Product.barcode.ilike(search_filter)
            )
        )
        
    products = query.all()
    for product in products:
        product.stock_quantity = get_product_stock(db, product.id)
        
    return products

@router.get("/{id}", response_model=ProductResponse)
def get_product(id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {id} not found."
        )
    product.stock_quantity = get_product_stock(db, product.id)
    return product

@router.put("/{id}", response_model=ProductResponse)
def update_product(id: int, product_in: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {id} not found."
        )

    # Validate category if being updated
    if product_in.category_id is not None:
        category = db.query(Category).filter(Category.id == product_in.category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category with id {product_in.category_id} does not exist."
            )

    # Validate SKU uniqueness if being updated
    if product_in.sku is not None and product_in.sku != product.sku:
        existing = db.query(Product).filter(Product.sku == product_in.sku).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product with SKU '{product_in.sku}' already exists."
            )

    # Update fields
    update_data = product_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    product.stock_quantity = get_product_stock(db, product.id)
    return product

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {id} not found."
        )
    
    # Clean up associated inventory entries first
    db.query(Inventory).filter(Inventory.product_id == id).delete(synchronize_session=False)
    db.delete(product)
    db.commit()
    return None


@router.post("/scan", response_model=ProductScanResponse)
def scan_product_barcode(scan_in: ProductScanRequest, db: Session = Depends(get_db)):
    # 1. Validate action value (must be IN or OUT)
    action = scan_in.action.upper().strip()
    if action not in ["IN", "OUT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action must be either 'IN' or 'OUT'."
        )
    
    # 2. Check if the product exists with the given barcode
    barcode = scan_in.barcode.strip()
    product = db.query(Product).filter(Product.barcode == barcode).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with barcode '{barcode}' not found."
        )
    
    # 3. Check if the warehouse exists
    warehouse = db.query(Warehouse).filter(Warehouse.id == scan_in.warehouse_id).first()
    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with id {scan_in.warehouse_id} not found."
        )
        
    # 4. Fetch or create inventory record for this product and warehouse
    inventory = db.query(Inventory).filter(
        Inventory.product_id == product.id,
        Inventory.warehouse_id == warehouse.id
    ).first()
    
    if not inventory:
        inventory = Inventory(
            product_id=product.id,
            warehouse_id=warehouse.id,
            quantity_available=0,
            quantity_reserved=0
        )
        db.add(inventory)
        
    # 5. Apply IN or OUT adjustment
    qty_adj = scan_in.quantity if scan_in.quantity is not None else 1
    if qty_adj <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity to scan must be a positive integer."
        )
        
    if action == "IN":
        inventory.quantity_available += qty_adj
        msg = f"Successfully scanned IN: {qty_adj} unit(s) of {product.product_name} added to warehouse {warehouse.warehouse_name}."
    else:  # OUT
        if inventory.quantity_available < qty_adj:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock in warehouse '{warehouse.warehouse_name}'. Available: {inventory.quantity_available}, trying to scan OUT: {qty_adj}."
            )
        inventory.quantity_available -= qty_adj
        msg = f"Successfully scanned OUT: {qty_adj} unit(s) of {product.product_name} removed from warehouse {warehouse.warehouse_name}."
        
    db.commit()
    db.refresh(inventory)
    
    return {
        "product_name": product.product_name,
        "sku": product.sku,
        "barcode": product.barcode,
        "warehouse_id": warehouse.id,
        "quantity_available": inventory.quantity_available,
        "action": action,
        "message": msg
    }

