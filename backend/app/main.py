from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text, inspect

import os

from app.database import Base, engine

# ROUTES
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
from app.routes.users import router as users_router
from app.routes.boms import router as bom_router
from app.routes.production_orders import router as production_order_router
from app.routes.purchase_requests import router as purchase_request_router
from app.routes.grn import router as grn_router

# IMPORT ALL MODELS
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
    inventory_log,
    bom,
    bom_item,
    bom_version,
    production_order,
    material_reservation,
    purchase_request,
    stock_movement
)

# CREATE TABLES
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Stock Management API",
    description="Backend API for BOM-based stock and inventory management",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.136:5173",
        "http://100.80.224.93:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# STATIC FILES
_static_dir = os.path.join(os.path.dirname(__file__), "static")

app.mount(
    "/static",
    StaticFiles(directory=_static_dir),
    name="static"
)

# SIMPLE MIGRATION
def run_migrations():

    try:
        inspector = inspect(engine)

        if "users" in inspector.get_table_names():

            columns = [
                col["name"]
                for col in inspector.get_columns("users")
            ]

            if "role" not in columns:

                with engine.connect() as conn:

                    conn.execute(
                        text(
                            "ALTER TABLE users "
                            "ADD COLUMN role VARCHAR(50) DEFAULT 'STAFF'"
                        )
                    )

                    conn.commit()

                    print("Migration completed.")

    except Exception as e:

        print(f"Migration error: {e}")


run_migrations()

# HOME
@app.get("/")
def home():

    return {
        "message": "Smart Stock Management API Running"
    }

# QR SCANNER PAGE
@app.get("/scanner")
def qr_scanner():

    html_path = os.path.join(
        os.path.dirname(__file__),
        "static",
        "qr_scanner.html"
    )

    return FileResponse(html_path)

# DATABASE SEEDING
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

        # CATEGORY SEED
        if db.query(Category).count() == 0:

            categories = [

                Category(
                    category_name="Electronics",
                    description="Electronic goods"
                ),

                Category(
                    category_name="Apparel",
                    description="Clothing and accessories"
                ),

                Category(
                    category_name="Furniture",
                    description="Office and home furniture"
                )
            ]

            db.add_all(categories)

            db.commit()

        # WAREHOUSE SEED
        if db.query(Warehouse).count() == 0:

            warehouses = [

                Warehouse(
                    warehouse_name="Central Warehouse",
                    location="Building A"
                ),

                Warehouse(
                    warehouse_name="East Warehouse",
                    location="Boston"
                ),

                Warehouse(
                    warehouse_name="West Warehouse",
                    location="San Francisco"
                )
            ]

            db.add_all(warehouses)

            db.commit()

        # PRODUCT SEED
        if db.query(Product).count() == 0:

            category_id = db.query(Category).first().id

            warehouse_id = db.query(Warehouse).first().id

            products = [

                Product(
                    product_name="Wireless Mouse",
                    sku="ELEC-MOU-001",
                    barcode="111111",
                    category_id=category_id,
                    selling_price=Decimal("25.99"),
                    reorder_level=10,
                    unit="pcs",
                    is_active=True
                ),

                Product(
                    product_name="Mechanical Keyboard",
                    sku="ELEC-KEY-001",
                    barcode="222222",
                    category_id=category_id,
                    selling_price=Decimal("89.99"),
                    reorder_level=5,
                    unit="pcs",
                    is_active=True
                )
            ]

            db.add_all(products)

            db.commit()

            # INVENTORY SEED
            for product in db.query(Product).all():

                inventory_item = Inventory(
                    product_id=product.id,
                    warehouse_id=warehouse_id,
                    quantity=100,
                    quantity_reserved=0
                )

                db.add(inventory_item)

            db.commit()

    except Exception as e:

        print(f"Seeding error: {e}")

    finally:

        db.close()

# ROUTERS
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

app.include_router(users_router)

app.include_router(bom_router)

app.include_router(production_order_router)

app.include_router(purchase_request_router)
app.include_router(grn_router)