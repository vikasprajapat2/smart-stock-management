from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
from app.database import Base, engine
from app.routes.auth import router as auth_router
from app.routes.categories import router as category_router
from app.routes.products import router as product_router
from app.routes.suppliers import router as supplier_router
from app.routes.purchase_orders import router as purchase_order_router
from app.routes.inventory import router as inventory_router
from app.routes.order import router as order_router
from app.routes.warehouses import router as warehouse_router
from app.routes.notifications import router as notification_router
from app.routes.dashboard import router as dashboard_router

# Import all models to ensure they are registered on the metadata
from app.models import (
    user,
    role,
    category,
    product,
    inventory,
    warehouse,
    supplier,
    purchase_order,
    order,
    order_item,
    notification,
    inventory_log
)

from fastapi.middleware.cors import CORSMiddleware

# Auto-create tables in development database
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Stock Management API",
    description="Backend API for BOM-based stock and inventory management",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory
_static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=_static_dir), name="static")

@app.on_event("startup")
def seed_database():
    from app.database import SessionLocal
    from app.models.category import Category
    from app.models.warehouse import Warehouse
    from app.models.product import Product
    from app.models.inventory import Inventory
    from decimal import Decimal

    db = SessionLocal()
    try:
        # Check if categories exist, if not seed some
        if db.query(Category).count() == 0:
            cats = [
                Category(category_name="Electronics", description="Electronic goods"),
                Category(category_name="Apparel", description="Clothing and accessories"),
                Category(category_name="Furniture", description="Office and home furniture")
            ]
            db.add_all(cats)
            db.commit()

        # Check if warehouses exist, if not seed some
        if db.query(Warehouse).count() == 0:
            whs = [
                Warehouse(warehouse_name="Central PostgreSQL Warehouse", location="Main Headquarter Building A"),
                Warehouse(warehouse_name="East Coast Storage Hub", location="Boston Terminal 4"),
                Warehouse(warehouse_name="West Coast Distribution Center", location="San Francisco Port Suite 10")
            ]
            db.add_all(whs)
            db.commit()

        # Check if products exist, if not seed some
        if db.query(Product).count() == 0:
            cat_id = db.query(Category).first().id
            wh_id = db.query(Warehouse).first().id
            prods = [
                Product(product_name="Wireless Mouse", sku="ELEC-MOU-098", barcode="1234567890", category_id=cat_id, selling_price=Decimal("25.99"), reorder_level=10, unit="pcs", is_active=True),
                Product(product_name="Mechanical Keyboard", sku="ELEC-KEY-432", barcode="9876543210", category_id=cat_id, selling_price=Decimal("89.99"), reorder_level=5, unit="pcs", is_active=True),
                Product(product_name="HDMI Cable 2.0", sku="ELEC-CAB-112", barcode="5556667778", category_id=cat_id, selling_price=Decimal("9.99"), reorder_level=20, unit="pcs", is_active=True)
            ]
            db.add_all(prods)
            db.commit()

            # Seed initial stock for products in the first warehouse
            for p in db.query(Product).all():
                inv = Inventory(product_id=p.id, warehouse_id=wh_id, quantity=100, quantity_reserved=0)
                db.add(inv)
            db.commit()
    except Exception as e:
        print(f"Error during seeding: {e}")
    finally:
        db.close()

@app.get('/')
def home():
    return {'message': 'Smart Stock Management API Running'}

@app.get('/scanner')
def qr_scanner():
    """Serve the QR / Barcode Scanner UI page."""
    html_path = os.path.join(os.path.dirname(__file__), "static", "qr_scanner.html")
    return FileResponse(html_path)

app.include_router(auth_router)
app.include_router(category_router)
app.include_router(product_router)
app.include_router(supplier_router)
app.include_router(purchase_order_router)
app.include_router(inventory_router)
app.include_router(order_router)
app.include_router(warehouse_router)
app.include_router(
    notification_router,
    prefix="/notifications",
    tags=["Notifications"]
)
app.include_router(dashboard_router)