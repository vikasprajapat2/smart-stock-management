from fastapi import FastAPI
from app.database import Base, engine
from app.routes.auth import router as auth_router

from app.models import (
    user,
    role,
    category,
    product,
    inventory,
    warehouse
)

Base.metadata.create_all(bind=engine)
app = FastAPI()


@app.get('/')
def home():
    return {'message': 'Smart Stock Management API Running'}

app.include_router(auth_router)