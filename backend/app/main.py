from fastapi import FastAPI
from app.routes.auth import router as auth_router
from app.routes.inventory import router as inventory_router
from app.routes.order import router as order_router
from app.database import Base, engine
import app.models  # noqa: F401

app = FastAPI()

@app.on_event('startup')
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get('/')
def home():
    return {'message': 'Smart Stock Management API Running'}

app.include_router(auth_router)
app.include_router(inventory_router)
app.include_router(order_router)