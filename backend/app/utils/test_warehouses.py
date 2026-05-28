import subprocess
import time
import socket
import requests
import sys
import os

# Adjust path to import models
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.database import DATABASE_URL, SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.warehouse import Warehouse
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.category import Category

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

def setup_db():
    db = SessionLocal()
    try:
        # 1. Clean up test inventory and test product if any exists
        test_product = db.query(Product).filter(Product.sku == "TEST-SKU-123").first()
        if test_product:
            db.query(Inventory).filter(Inventory.product_id == test_product.id).delete()
            db.query(Product).filter(Product.id == test_product.id).delete()

        # 2. Clean up test category
        db.query(Category).filter(Category.category_name == "Test Category").delete()

        # 3. Clean up test warehouses
        db.query(Warehouse).filter(Warehouse.warehouse_name.like("Test Warehouse Alpha%")).delete()

        # 4. Clean up test manager/user
        test_user = db.query(User).filter(User.email == "manager@warehouse.com").first()
        if test_user:
            db.query(User).filter(User.id == test_user.id).delete()

        db.commit()

        user = User(
            full_name="Warehouse Manager",
            email="manager@warehouse.com",
            password_hash="hashedpass",
            role="MANAGER",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return user.id
    except Exception as e:
        db.rollback()
        print("Setup DB Error:", e)
        raise
    finally:
        db.close()

def run_tests(manager_id):
    print("Starting Warehouse CRUD Integration Tests...")

    # 1. Test POST /warehouses/ (Create)
    payload = {
        "warehouse_name": "Test Warehouse Alpha",
        "location": "Sector 5, Industrial Area",
        "manager_id": manager_id
    }
    r = requests.post(f"{API_URL}/warehouses/", json=payload)
    assert r.status_code == 201, f"Failed to create warehouse: {r.text}"
    w = r.json()
    warehouse_id = w["id"]
    print(f"  [PASSED] Created warehouse with ID: {warehouse_id}")

    # Test create with non-existent manager (should fail)
    bad_payload = {
        "warehouse_name": "Ghost Warehouse",
        "manager_id": 9999
    }
    r = requests.post(f"{API_URL}/warehouses/", json=bad_payload)
    assert r.status_code == 400, f"Expected 400 for bad manager, got {r.status_code}: {r.text}"
    print("  [PASSED] Invalid manager ID validation on creation")

    # 2. Test GET /warehouses/ (List & Search)
    r = requests.get(f"{API_URL}/warehouses/")
    assert r.status_code == 200
    assert any(item["id"] == warehouse_id for item in r.json())
    print("  [PASSED] List warehouses contains created warehouse")

    r = requests.get(f"{API_URL}/warehouses/?search=Alpha")
    assert r.status_code == 200
    assert len(r.json()) > 0
    assert r.json()[0]["warehouse_name"] == "Test Warehouse Alpha"
    print("  [PASSED] Search warehouses by name")

    r = requests.get(f"{API_URL}/warehouses/?search=Sector")
    assert r.status_code == 200
    assert len(r.json()) > 0
    assert r.json()[0]["location"] == "Sector 5, Industrial Area"
    print("  [PASSED] Search warehouses by location")

    # 3. Test GET /warehouses/{id} (Retrieve)
    r = requests.get(f"{API_URL}/warehouses/{warehouse_id}")
    assert r.status_code == 200
    assert r.json()["warehouse_name"] == "Test Warehouse Alpha"
    print("  [PASSED] Retrieve warehouse by ID")

    # 4. Test PUT /warehouses/{id} (Update)
    update_payload = {
        "warehouse_name": "Test Warehouse Alpha Updated",
        "location": "Sector 6, Industrial Area"
    }
    r = requests.put(f"{API_URL}/warehouses/{warehouse_id}", json=update_payload)
    assert r.status_code == 200
    assert r.json()["warehouse_name"] == "Test Warehouse Alpha Updated"
    assert r.json()["location"] == "Sector 6, Industrial Area"
    print("  [PASSED] Update warehouse details")

    # 5. Test DELETE /warehouses/{id} blocking with inventory/relations
    # Setup Category, Product and Inventory associated with warehouse
    db = SessionLocal()
    try:
        cat = Category(category_name="Test Category")
        db.add(cat)
        db.commit()
        db.refresh(cat)

        prod = Product(
            product_name="Test Product",
            sku="TEST-SKU-123",
            category_id=cat.id,
            selling_price=10.0
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)

        inv = Inventory(
            product_id=prod.id,
            warehouse_id=warehouse_id,
            quantity=100
        )
        db.add(inv)
        db.commit()
        print("  Created associated inventory to test deletion blocking...")
    except Exception as e:
        print("Error during deletion test setup:", e)
        db.rollback()
        raise
    finally:
        db.close()

    # Attempt to delete (should fail)
    r = requests.delete(f"{API_URL}/warehouses/{warehouse_id}")
    assert r.status_code == 400, f"Expected 400 for blocked deletion, got {r.status_code}: {r.text}"
    assert "Cannot delete warehouse with inventory" in r.json()["detail"]
    print("  [PASSED] Deletion blocked when associated inventory exists")

    # Clean up associated inventory/product/category
    db = SessionLocal()
    try:
        db.query(Inventory).filter(Inventory.warehouse_id == warehouse_id).delete()
        db.query(Product).filter(Product.sku == "TEST-SKU-123").delete()
        db.query(Category).filter(Category.category_name == "Test Category").delete()
        db.commit()
        print("  Cleaned up associated inventory/product/category...")
    except Exception as e:
        print("Error during deletion test cleanup:", e)
        db.rollback()
        raise
    finally:
        db.close()

    # Attempt to delete (should succeed)
    r = requests.delete(f"{API_URL}/warehouses/{warehouse_id}")
    assert r.status_code == 204
    print("  [PASSED] Deletion succeeds when no references exist")

    # Verify retrieval fails (404)
    r = requests.get(f"{API_URL}/warehouses/{warehouse_id}")
    assert r.status_code == 404
    print("  [PASSED] Deleted warehouse cannot be retrieved (404)")

    print("\n--- All Warehouse Tests Passed Successfully! ---")

def main():
    manager_id = setup_db()

    # Start FastAPI server as a subprocess
    env = os.environ.copy()
    env["PYTHONPATH"] = "backend"
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

        run_tests(manager_id)
    finally:
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    main()
