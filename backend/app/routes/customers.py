from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.customer import Customer
from app.schemas.customer_schema import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.post("/", response_model=CustomerResponse)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = db.query(Customer).filter(Customer.customer_code == customer.customer_code).first()
    if db_customer:
        raise HTTPException(status_code=400, detail="Customer code already exists")
    
    new_customer = Customer(**customer.model_dump())
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.get("/", response_model=List[CustomerResponse])
def get_customers(skip: int = 0, limit: int = 100, search: str = None, db: Session = Depends(get_db)):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.customer_name.ilike(f"%{search}%") | Customer.customer_code.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, updates: CustomerUpdate, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
    
    db.commit()
    db.refresh(customer)
    return customer

@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Check if customer has sales orders before deleting
    # if len(customer.sales_orders) > 0:
    #     raise HTTPException(status_code=400, detail="Cannot delete customer with existing sales orders")
        
    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted successfully"}
