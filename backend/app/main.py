from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.routes.categories import router as category_router
from app.routes.products import router as product_router

# Import all models to ensure they are registered on the metadata
from app.models import (
    user,
    role,
    category,
    product,
    inventory,
    warehouse,
    supplier
)

# Auto-create tables in development database
Base.metadata.create_all(bind=engine)

@app.get('/')
def home():
    return {'message': 'Smart Stock Management API Running'}

app.include_router(auth_router)
app.include_router(category_router)
app.include_router(product_router)