# backend/app/routes/product_excel.py

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
import pandas as pd

from app.database import get_db
from app.models.product import Product

router = APIRouter(
    prefix="/products",
    tags=["Product Excel"]
)

# ==============================
# DOWNLOAD TEMPLATE
# ==============================

@router.get("/template")
def download_product_template():

    data = {
        "product_name": ["MacBook Pro"],
        "selling_price": [120000],
        "reorder_level": [5],
        "unit": ["pcs"],
        "initial_stock": [100]
    }

    df = pd.DataFrame(data)

    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Products")

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=product_template.xlsx"
        }
    )


# ==============================
# EXPORT PRODUCTS
# ==============================

@router.get("/export")
def export_products(
    db: Session = Depends(get_db)
):

    products = db.query(Product).all()

    data = []

    for product in products:

        data.append({
            "id": product.id,
            "product_name": product.product_name,
            "sku": product.sku,
            "barcode": product.barcode,
            "selling_price": float(product.selling_price or 0),
            "reorder_level": product.reorder_level,
            "unit": product.unit,
            "is_active": product.is_active
        })

    df = pd.DataFrame(data)

    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Products")

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=products.xlsx"
        }
    )


# ==============================
# IMPORT PRODUCTS
# ==============================
@router.post("/import")
def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    contents = file.file.read()
    import io
    try:
        df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid Excel file or format. Error: {str(e)}")

    try:
        # Fill NaN values to prevent 'cannot convert float NaN to integer' errors
        df = df.fillna({
            "product_name": "Unknown Product",
            "selling_price": 0.0,
            "reorder_level": 0,
            "unit": "pcs",
            "initial_stock": 0
        })

        from app.utils.product_helpers import generate_sku, generate_barcode
        from app.models.inventory import Inventory
        from app.models.warehouse import Warehouse
        
        # Get or create Main Warehouse
        main_warehouse = db.query(Warehouse).filter(Warehouse.warehouse_name == "Main Warehouse").first()
        if not main_warehouse:
            main_warehouse = Warehouse(warehouse_name="Main Warehouse", location="Main Location")
            db.add(main_warehouse)
            db.commit()
            db.refresh(main_warehouse)
        
        imported = 0
        for _, row in df.iterrows():
            prod_name = str(row.get("product_name", "Unknown Product")).strip()
            stock_to_add = int(float(row.get("initial_stock", 0)))
            
            # Check if product already exists
            product = db.query(Product).filter(Product.product_name == prod_name).first()
            
            if product:
                # Update existing product details if needed (optional, keeping it simple)
                pass
            else:
                # Create new product
                # Generate SKU
                sku = None
                for _ in range(5):
                    temp_sku = generate_sku(prod_name, None)
                    if not db.query(Product).filter(Product.sku == temp_sku).first():
                        sku = temp_sku
                        break
                if not sku:
                    import uuid
                    sku = str(uuid.uuid4())[:10].upper()
                    
                # Generate Barcode
                barcode = None
                for _ in range(5):
                    temp_barcode = generate_barcode()
                    if not db.query(Product).filter(Product.barcode == temp_barcode).first():
                        barcode = temp_barcode
                        break
                if not barcode:
                    import random
                    barcode = str(random.randint(1000000000, 9999999999))

                product = Product(
                    product_name=prod_name,
                    selling_price=float(row.get("selling_price", 0.0)),
                    reorder_level=int(float(row.get("reorder_level", 0))),
                    unit=str(row.get("unit", "pcs")),
                    sku=sku,
                    barcode=barcode,
                    is_active=True
                )
                db.add(product)
                db.flush() # flush to get product.id for inventory
                
            # Handle Inventory
            if stock_to_add > 0:
                inventory = db.query(Inventory).filter(
                    Inventory.product_id == product.id,
                    Inventory.warehouse_id == main_warehouse.id
                ).first()
                if inventory:
                    inventory.quantity += stock_to_add
                else:
                    new_inventory = Inventory(
                        product_id=product.id,
                        warehouse_id=main_warehouse.id,
                        quantity=stock_to_add
                    )
                    db.add(new_inventory)

            imported += 1
        db.commit()
    except Exception as e:
        db.rollback()
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Database error during import: {str(e)}")

    return {
        "message": f"{imported} products imported successfully"
    }
# backend/app/routes/product_excel.py

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
import pandas as pd

from app.database import get_db
from app.models.product import Product

router = APIRouter(
    prefix="/products",
    tags=["Product Excel"]
)

# ==============================
# DOWNLOAD TEMPLATE
# ==============================

@router.get("/template")
def download_product_template():

    data = {
        "product_name": ["MacBook Pro"],
        "selling_price": [120000],
        "reorder_level": [5],
        "unit": ["pcs"]
    }

    df = pd.DataFrame(data)

    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Products")

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=product_template.xlsx"
        }
    )


# ==============================
# EXPORT PRODUCTS
# ==============================

@router.get("/export")
def export_products(
    db: Session = Depends(get_db)
):

    products = db.query(Product).all()

    data = []

    for product in products:

        data.append({
            "id": product.id,
            "product_name": product.product_name,
            "sku": product.sku,
            "barcode": product.barcode,
            "selling_price": float(product.selling_price or 0),
            "reorder_level": product.reorder_level,
            "unit": product.unit,
            "is_active": product.is_active
        })

    df = pd.DataFrame(data)

    output = BytesIO()

    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Products")

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=products.xlsx"
        }
    )


# ==============================
# IMPORT PRODUCTS
# ==============================

@router.post("/import")
def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    df = pd.read_excel(file.file)
    df = df.fillna("")

    imported = 0

    for _, row in df.iterrows():
        product = Product(
            product_name=str(row["product_name"]),
            selling_price=float(row["selling_price"] or 0),
            reorder_level=int(float(row["reorder_level"] or 0)),
            unit=str(row["unit"] or "pcs"),
            is_active=True
        )

        

        db.add(product)

        imported += 1

    db.commit()

    return {
        "message": f"{imported} products imported successfully"
    }