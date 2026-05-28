import sys
import os
import requests
import subprocess
import time
import socket

# Adjust path to import models
sys.path.append("/home/ashish/Documents/Confidential/smart-stock-management/backend")

from app.main import app
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

API_URL = "http://127.0.0.1:8000"


def is_port_open(ip, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    try:
        s.connect((ip, port))
        s.close()
        return True
    except socket.error:
        return False

def setup_db_requirements():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Clean up any leftover test data from previous runs
        session.query(User).filter(User.email == "api_test_admin@test.com").delete(synchronize_session=False)
        session.query(PurchaseOrderItem).filter(PurchaseOrderItem.unit_price == 25.00).delete(synchronize_session=False)
        session.query(PurchaseOrder).filter(PurchaseOrder.po_number.like("PO-%")).delete(synchronize_session=False)
        session.query(Inventory).filter(Inventory.quantity == 50).delete(synchronize_session=False)
        session.query(Product).filter(Product.product_name == "API Test Product").delete(synchronize_session=False)
        session.query(Category).filter(Category.category_name == "API Test Category").delete(synchronize_session=False)
        session.query(Supplier).filter(Supplier.supplier_name == "API Test Supplier").delete(synchronize_session=False)
        session.commit()
        # Ensure a user exists
        user = session.query(User).first()
        if not user:
            user = User(
                full_name="testmanager",
                email="manager@test.com",
                password_hash="fakehash",
                role="ADMIN",
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
    
    # Register and login a test user
    reg_payload = {
        "full_name": "API Test Admin",
        "email": "api_test_admin@test.com",
        "password": "password123",
        "role": "ADMIN"
    }
    r = requests.post(f"{API_URL}/auth/register", json=reg_payload)
    assert r.status_code == 200, f"Registration failed: {r.text}"

    login_data = {
        "username": "api_test_admin@test.com",
        "password": "password123"
    }
    r = requests.post(f"{API_URL}/auth/login", data=login_data)
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]

    client = requests.Session()
    client.headers.update({"Authorization": f"Bearer {token}"})

    # 1. Test Category CRUD
    print("Testing Category CRUD...")
    
    # POST /categories/
    cat_payload = {"category_name": "API Test Category", "description": "Temp description"}
    r = client.post(f"{API_URL}/categories/", json=cat_payload)
    assert r.status_code == 201, f"Failed post category: {r.text}"
    cat = r.json()
    cat_id = cat["id"]
    print(f"  [PASSED] Created Category with ID: {cat_id}")

    # GET /categories/
    r = client.get(f"{API_URL}/categories/")
    assert r.status_code == 200
    assert any(c["id"] == cat_id for c in r.json())
    print("  [PASSED] List Categories contains new Category")

    # GET /categories/{id}
    r = client.get(f"{API_URL}/categories/{cat_id}")
    assert r.status_code == 200
    assert r.json()["category_name"] == "API Test Category"
    print("  [PASSED] Retrieve Category by ID")

    # PUT /categories/{id}
    r = client.put(f"{API_URL}/categories/{cat_id}", json={"description": "Updated description"})
    assert r.status_code == 200
    assert r.json()["description"] == "Updated description"
    print("  [PASSED] Update Category")

    # 2. Test Product CRUD & Search
    print("\nTesting Product & Search...")
    
    # POST /products/
    prod_payload = {
        "product_name": "API Test Product",
        "sku": "API-TEST-SKU",
        "category_id": cat_id,
        "selling_price": 49.99,
        "reorder_level": 10,
        "unit": "pcs",
        "is_active": True
    }
    r = client.post(f"{API_URL}/products/", json=prod_payload)
    assert r.status_code == 201, f"Failed post product: {r.text}"
    prod = r.json()
    prod_id = prod["id"]
    print(f"  [PASSED] Created Product with ID: {prod_id}, SKU: {prod['sku']}, Barcode: {prod['barcode']}")

    # GET /products/ with Search
    r = client.get(f"{API_URL}/products/?search=API Test")
    assert r.status_code == 200
    assert len(r.json()) > 0
    assert any(p["id"] == prod_id for p in r.json())
    print("  [PASSED] Product Search works")

    # DELETE /categories/{id} should fail due to product relationship
    r = client.delete(f"{API_URL}/categories/{cat_id}")
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
    r = client.post(f"{API_URL}/suppliers/", json=sup_payload)
    assert r.status_code == 201, f"Failed post supplier: {r.text}"
    sup = r.json()
    sup_id = sup["id"]
    print(f"  [PASSED] Created Supplier with ID: {sup_id}")

    # GET /suppliers/
    r = client.get(f"{API_URL}/suppliers/")
    assert r.status_code == 200
    assert any(s["id"] == sup_id for s in r.json())
    print("  [PASSED] List Suppliers contains new Supplier")

    # PUT /suppliers/{id}
    r = client.put(f"{API_URL}/suppliers/{sup_id}", json={"contact_name": "Jane Doe"})
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
    r = client.post(f"{API_URL}/purchase-orders/", json=po_payload)
    assert r.status_code == 201, f"Failed post PO: {r.text}"
    po = r.json()
    po_id = po["id"]
    print(f"  [PASSED] Created Purchase Order with ID: {po_id}, PO Number: {po['po_number']}, Total: {po['total_amount']}")

    # GET /suppliers/{id}/history (Supplier History)
    r = client.get(f"{API_URL}/suppliers/{sup_id}/history")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["po_number"] == po["po_number"]
    print("  [PASSED] Supplier history matches created PO")

    # Verify inventory is 0 initially
    r = client.get(f"{API_URL}/products/{prod_id}")
    assert r.status_code == 200
    assert r.json()["stock_quantity"] == 0
    print("  [PASSED] Initial product stock_quantity is 0")

    # PUT /purchase-orders/{id} to COMPLETED (should trigger inventory update)
    r = client.put(f"{API_URL}/purchase-orders/{po_id}", json={"status": "COMPLETED"})
    assert r.status_code == 200, f"Failed to complete PO: {r.text}"
    print("  [PASSED] Updated Purchase Order status to COMPLETED")

    # Verify inventory has increased
    r = client.get(f"{API_URL}/products/{prod_id}")
    assert r.status_code == 200
    assert r.json()["stock_quantity"] == 50
    print("  [PASSED] Product stock_quantity successfully incremented to 50 in inventory")

    # DELETE /purchase-orders/{id} should fail now because it's COMPLETED
    r = client.delete(f"{API_URL}/purchase-orders/{po_id}")
    assert r.status_code == 400
    assert "Cannot delete a COMPLETED purchase order." in r.json()["detail"]
    print("  [PASSED] Completed PO deletion blocked")

    # DELETE /suppliers/{id} should fail because of PO relationship
    r = client.delete(f"{API_URL}/suppliers/{sup_id}")
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

def main():
    w_id = setup_db_requirements()

    # Start FastAPI server as a subprocess
    env = os.environ.copy()
    env["PYTHONPATH"] = "/home/ashish/Documents/Confidential/smart-stock-management/backend"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )

    try:
        # Wait for server to start
        for _ in range(30):
            if is_port_open("127.0.0.1", 8000):
                break
            time.sleep(0.2)
        else:
            print("Error: FastAPI server failed to start on port 8000")
            # Print uvicorn output
            stdout, stderr = proc.communicate(timeout=1)
            print("STDOUT:", stdout.decode())
            print("STDERR:", stderr.decode())
            sys.exit(1)

        run_tests(w_id)
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    main()
