import sys
import os
import requests

# Adjust path to import models
sys.path.append("/home/ashish/Documents/Confidential/smart-stock-management/backend")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app.models.user import User
from app.models.role import Role
from app.models.warehouse import Warehouse
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.category import Category
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem

API_URL = "http://localhost:8000"

def setup_db_requirements():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Clean up any leftover test data from previous runs
        session.query(PurchaseOrderItem).filter(PurchaseOrderItem.unit_price == 25.00).delete(synchronize_session=False)
        session.query(PurchaseOrder).filter(PurchaseOrder.po_number.like("PO-%")).delete(synchronize_session=False)
        session.query(Inventory).filter(Inventory.quantity == 50).delete(synchronize_session=False)
        session.query(Product).filter(Product.product_name == "API Test Product").delete(synchronize_session=False)
        session.query(Category).filter(Category.category_name == "API Test Category").delete(synchronize_session=False)
        session.query(Supplier).filter(Supplier.supplier_name == "API Test Supplier").delete(synchronize_session=False)
        session.commit()
        # 1. Ensure a role exists (default Admin role)
        role = session.query(Role).first()
        if not role:
            role = Role(role_name="Admin")
            session.add(role)
            session.commit()
            session.refresh(role)
            print(f"Created Test Role: {role.role_name} (ID: {role.id})")

        # 2. Ensure a user exists
        user = session.query(User).first()
        if not user:
            user = User(
                full_name="testmanager",
                email="manager@test.com",
                password_hash="fakehash",
                role_id=role.id,
                is_active=True
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"Created Test User: {user.full_name} (ID: {user.id})")

        # 3. Ensure a warehouse exists
        warehouse = session.query(Warehouse).first()
        if not warehouse:
            warehouse = Warehouse(
                warehouse_name="Main Test Warehouse",
                location="Test Location",
                manager_id=user.id
            )
            session.add(warehouse)
            session.commit()
            session.refresh(warehouse)
            print(f"Created Test Warehouse: {warehouse.warehouse_name} (ID: {warehouse.id})")

        return warehouse.id
    except Exception as e:
        session.rollback()
        print("Setup error:", e)
        sys.exit(1)
    finally:
        session.close()

def run_tests(warehouse_id):
    print("\n--- Starting API Tests ---\n")
    
    # 1. Test Category CRUD
    print("Testing Category CRUD...")
    
    # POST /categories/
    cat_payload = {"category_name": "API Test Category", "description": "Temp description"}
    r = requests.post(f"{API_URL}/categories/", json=cat_payload)
    assert r.status_code == 201, f"Failed post category: {r.text}"
    cat = r.json()
    cat_id = cat["id"]
    print(f"  [PASSED] Created Category with ID: {cat_id}")

    # GET /categories/
    r = requests.get(f"{API_URL}/categories/")
    assert r.status_code == 200
    assert any(c["id"] == cat_id for c in r.json())
    print("  [PASSED] List Categories contains new Category")

    # GET /categories/{id}
    r = requests.get(f"{API_URL}/categories/{cat_id}")
    assert r.status_code == 200
    assert r.json()["category_name"] == "API Test Category"
    print("  [PASSED] Retrieve Category by ID")

    # PUT /categories/{id}
    r = requests.put(f"{API_URL}/categories/{cat_id}", json={"description": "Updated description"})
    assert r.status_code == 200
    assert r.json()["description"] == "Updated description"
    print("  [PASSED] Update Category")

    # 2. Test Product CRUD & Search
    print("\nTesting Product & Search...")
    
    # POST /products/
    prod_payload = {
        "product_name": "API Test Product",
        "category_id": cat_id,
        "selling_price": 49.99,
        "reorder_level": 10,
        "unit": "pcs",
        "is_active": True
    }
    r = requests.post(f"{API_URL}/products/", json=prod_payload)
    assert r.status_code == 201, f"Failed post product: {r.text}"
    prod = r.json()
    prod_id = prod["id"]
    print(f"  [PASSED] Created Product with ID: {prod_id}, SKU: {prod['sku']}, Barcode: {prod['barcode']}")

    # GET /products/ with Search
    r = requests.get(f"{API_URL}/products/?search=API Test")
    assert r.status_code == 200
    assert len(r.json()) > 0
    assert any(p["id"] == prod_id for p in r.json())
    print("  [PASSED] Product Search works")

    # DELETE /categories/{id} should fail due to product relationship
    r = requests.delete(f"{API_URL}/categories/{cat_id}")
    assert r.status_code == 400
    assert "Cannot delete category with associated products." in r.json()["detail"]
    print("  [PASSED] Category deletion blocked when products exist")

    # 3. Test Supplier CRUD
    print("\nTesting Supplier CRUD...")
    
    # POST /suppliers/
    sup_payload = {
        "supplier_name": "API Test Supplier",
        "contact_name": "John Doe",
        "email": "john@testsupplier.com",
        "phone": "1234567890",
        "address": "Supplier Street 1",
        "is_active": True
    }
    r = requests.post(f"{API_URL}/suppliers/", json=sup_payload)
    assert r.status_code == 201, f"Failed post supplier: {r.text}"
    sup = r.json()
    sup_id = sup["id"]
    print(f"  [PASSED] Created Supplier with ID: {sup_id}")

    # GET /suppliers/
    r = requests.get(f"{API_URL}/suppliers/")
    assert r.status_code == 200
    assert any(s["id"] == sup_id for s in r.json())
    print("  [PASSED] List Suppliers contains new Supplier")

    # PUT /suppliers/{id}
    r = requests.put(f"{API_URL}/suppliers/{sup_id}", json={"contact_name": "Jane Doe"})
    assert r.status_code == 200
    assert r.json()["contact_name"] == "Jane Doe"
    print("  [PASSED] Update Supplier details")

    # 4. Test Purchase Order CRUD & Inventory Flow
    print("\nTesting Purchase Order CRUD and Inventory Flow...")
    
    # POST /purchase-orders/
    po_payload = {
        "supplier_id": sup_id,
        "warehouse_id": warehouse_id,
        "status": "PENDING",
        "items": [
            {
                "product_id": prod_id,
                "quantity": 50,
                "unit_price": 25.00
            }
        ]
    }
    r = requests.post(f"{API_URL}/purchase-orders/", json=po_payload)
    assert r.status_code == 201, f"Failed post PO: {r.text}"
    po = r.json()
    po_id = po["id"]
    print(f"  [PASSED] Created Purchase Order with ID: {po_id}, PO Number: {po['po_number']}, Total: {po['total_amount']}")

    # GET /suppliers/{id}/history (Supplier History)
    r = requests.get(f"{API_URL}/suppliers/{sup_id}/history")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["po_number"] == po["po_number"]
    print("  [PASSED] Supplier history matches created PO")

    # Verify inventory is 0 initially
    r = requests.get(f"{API_URL}/products/{prod_id}")
    assert r.status_code == 200
    assert r.json()["stock_quantity"] == 0
    print("  [PASSED] Initial product stock_quantity is 0")

    # PUT /purchase-orders/{id} to COMPLETED (should trigger inventory update)
    r = requests.put(f"{API_URL}/purchase-orders/{po_id}", json={"status": "COMPLETED"})
    assert r.status_code == 200, f"Failed to complete PO: {r.text}"
    print("  [PASSED] Updated Purchase Order status to COMPLETED")

    # Verify inventory has increased
    r = requests.get(f"{API_URL}/products/{prod_id}")
    assert r.status_code == 200
    assert r.json()["stock_quantity"] == 50
    print("  [PASSED] Product stock_quantity successfully incremented to 50 in inventory")

    # DELETE /purchase-orders/{id} should fail now because it's COMPLETED
    r = requests.delete(f"{API_URL}/purchase-orders/{po_id}")
    assert r.status_code == 400
    assert "Cannot delete a COMPLETED purchase order." in r.json()["detail"]
    print("  [PASSED] Completed PO deletion blocked")

    # DELETE /suppliers/{id} should fail because of PO relationship
    r = requests.delete(f"{API_URL}/suppliers/{sup_id}")
    assert r.status_code == 400
    assert "Cannot delete supplier with associated purchase orders." in r.json()["detail"]
    print("  [PASSED] Supplier deletion blocked when POs exist")

    # 5. Clean up objects manually from database using SQLAlchemy session
    print("\nCleaning up database...")
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        # Delete PO items
        session.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == po_id).delete()
        # Delete PO
        session.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).delete()
        # Delete inventory
        session.query(Inventory).filter(Inventory.product_id == prod_id).delete()
        # Delete product
        session.query(Product).filter(Product.id == prod_id).delete()
        # Delete category
        session.query(Category).filter(Category.id == cat_id).delete()
        # Delete supplier
        session.query(Supplier).filter(Supplier.id == sup_id).delete()
        session.commit()
        print("  [PASSED] All temporary database entries deleted cleanly.")
    except Exception as e:
        session.rollback()
        print("Cleanup error:", e)
    finally:
        session.close()

    print("\n--- All Tests Completed Successfully! ---")

if __name__ == "__main__":
    w_id = setup_db_requirements()
    run_tests(w_id)
