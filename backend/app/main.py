from fastapi import FastAPI
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
    notification
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

@app.get('/')
def home():
    return {'message': 'Smart Stock Management API Running'}

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