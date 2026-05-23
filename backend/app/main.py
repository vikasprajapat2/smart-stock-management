from fastapi import FastAPI
from app.database import Base, engine

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