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