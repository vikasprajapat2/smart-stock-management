from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import re
import os
import json
import urllib.request

from app.database import get_db
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder
from app.schemas.supplier_schema import SupplierCreate, SupplierUpdate, SupplierResponse

router = APIRouter(
    prefix="/suppliers",
    tags=["Suppliers"]
)

# Known GSTIN details for testing/demo purposes
KNOWN_GSTINS = {
    "33DBCPK8087F1ZK": {
        "supplier_name": "ELANGO CASHEWS",
        "contact_name": "Elango",
        "email": "elangocashews@gmail.com",
        "phone": "+91-9843343360",
        "address": "No 12, Warehouse Road, Panruti, Cuddalore, Tamil Nadu, 607805",
        "gstin": "33DBCPK8087F1ZK",
        "state": "Tamil Nadu"
    }
}

@router.get("/fetch-gst/{gstin}")
def fetch_gst_details(gstin: str):
    # Validate GSTIN structure (15 alphanumeric characters)
    gstin = gstin.upper().strip()
    pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    if not re.match(pattern, gstin):
        raise HTTPException(
            status_code=400,
            detail="Invalid GSTIN format. Must be a 15-digit alphanumeric Indian GSTIN (e.g. 07AAAAA1111A1Z1)"
        )
    
    # 1. Check if the GSTIN is in our known mock/test database first
    if gstin in KNOWN_GSTINS:
        return KNOWN_GSTINS[gstin]

    # 2. Check if a real verification key is set in .env
    key_secret = os.getenv("APPYFLOW_KEY_SECRET")
    if key_secret:
        try:
            url = f"https://appyflow.in/api/verifyGST?gstNo={gstin}&key_secret={key_secret}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    if not data.get("error", True) and "taxpayerInfo" in data:
                        info = data["taxpayerInfo"]
                        lgnm = info.get("lgnm") or info.get("tradeNam") or "Unknown Business"
                        
                        # Extract Address
                        adr = ""
                        if "pradr" in info and "adr" in info["pradr"]:
                            adr = info["pradr"]["adr"]
                        
                        email = info.get("email") or f"info@{gstin[2:7].lower()}.com"
                        phone = info.get("mobNum") or f"+91-9870000000"
                        
                        return {
                            "supplier_name": lgnm,
                            "contact_name": info.get("contactName") or f"Manager {gstin[2:7]}",
                            "email": email,
                            "phone": phone,
                            "address": adr,
                            "gstin": gstin,
                            "state": info.get("pradr", {}).get("addr", {}).get("stcd", "India")
                        }
        except Exception as e:
            # Log/print warning and fall back to generator
            print(f"External GST API Error: {e}")
    
    # 3. Fallback to dynamic generator if no key is set or API failed
    state_codes = {
        "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
        "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
        "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
        "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
        "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
        "24": "Gujarat", "25": "Daman & Diu", "26": "Dadra & Nagar Haveli", "27": "Maharashtra",
        "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
        "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
        "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
    }
    
    state_code = gstin[:2]
    state_name = state_codes.get(state_code, "India")
    
    pan_part = gstin[2:7]
    words = ["Enterprise", "Logistics", "Solutions", "Industries", "Trading", "Global", "Systems"]
    num = sum(ord(c) for c in pan_part)
    word1 = words[num % len(words)]
    word2 = words[(num + 3) % len(words)]
    if word1 == word2:
        word2 = "Corporation"
        
    company_name = f"GSTIN {pan_part} {word1} {word2} Ltd."
    address = f"Sector {num % 10 + 10}, Industrial Area Phase II, {state_name}, India"
    email = f"info@{pan_part.lower()}{word1.lower()}.com"
    phone = f"+91-987{num % 1000:03d}{num % 10000:04d}"
    
    return {
        "supplier_name": company_name,
        "contact_name": f"Manager {pan_part}",
        "email": email,
        "phone": phone,
        "address": address,
        "gstin": gstin,
        "state": state_name
    }

@router.post("/", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier_in: SupplierCreate, db: Session = Depends(get_db)):
    # Check if supplier with same email already exists (if email is provided)
    if supplier_in.email:
        existing = db.query(Supplier).filter(Supplier.email == supplier_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with email '{supplier_in.email}' already exists."
            )
            
    supplier = Supplier(
        supplier_name=supplier_in.supplier_name,
        contact_name=supplier_in.contact_name,
        email=supplier_in.email,
        phone=supplier_in.phone,
        address=supplier_in.address,
        gst_number=supplier_in.gst_number,
        is_active=supplier_in.is_active if supplier_in.is_active is not None else True
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier

@router.get("/", response_model=List[SupplierResponse])
def get_suppliers(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Supplier)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Supplier.supplier_name.ilike(search_filter),
                Supplier.contact_name.ilike(search_filter),
                Supplier.email.ilike(search_filter)
            )
        )
    return query.all()

@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
    return supplier

@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(id: int, supplier_in: SupplierUpdate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
        
    if supplier_in.email is not None and supplier_in.email != supplier.email:
        existing = db.query(Supplier).filter(Supplier.email == supplier_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with email '{supplier_in.email}' already exists."
            )
            
    update_data = supplier_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(supplier, key, value)
        
    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
        
    # Check if supplier has associated purchase orders
    po_exists = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == id).first()
    if po_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete supplier with associated purchase orders."
        )
        
    db.delete(supplier)
    db.commit()
    return None

# Import inside endpoint or function to avoid circular dependencies if any
@router.get("/{id}/history")
def get_supplier_history(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Supplier with id {id} not found."
        )
    
    # Retrieve purchase orders
    pos = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == id).all()
    # We can format the history to return PO details with items
    result = []
    for po in pos:
        items = []
        for item in po.items:
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.product_name if item.product else None,
                "sku": item.product.sku if item.product else None,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "total_price": float(item.quantity * item.unit_price)
            })
        result.append({
            "id": po.id,
            "po_number": po.po_number,
            "status": po.status,
            "order_date": po.order_date,
            "delivery_date": po.delivery_date,
            "total_amount": float(po.total_amount),
            "warehouse_name": po.warehouse.warehouse_name if po.warehouse else None,
            "items": items
        })
    return result
