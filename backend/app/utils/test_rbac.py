import sys
import os
from fastapi.testclient import TestClient

# Adjust path to import app and models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.category import Category
from app.models.warehouse import Warehouse
from app.models.supplier import Supplier
from app.models.product import Product
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog

client = TestClient(app)

def setup_rbac_test_data():
    db = SessionLocal()
    try:
        # 1. Clean up existing test data
        db.query(User).filter(User.email.in_(["admin@test.com", "manager@test.com", "staff@test.com"])).delete(synchronize_session=False)
        db.query(InventoryLog).delete(synchronize_session=False)
        db.query(Inventory).delete(synchronize_session=False)
        db.query(PurchaseOrderItem).delete(synchronize_session=False)
        db.query(PurchaseOrder).delete(synchronize_session=False)
        db.query(Product).filter(Product.product_name.like("RBAC Test%")).delete(synchronize_session=False)
        db.query(Category).filter(Category.category_name == "RBAC Test Category").delete(synchronize_session=False)
        db.query(Supplier).filter(Supplier.supplier_name == "RBAC Test Supplier").delete(synchronize_session=False)
        db.query(Warehouse).filter(Warehouse.warehouse_name == "RBAC Test Warehouse").delete(synchronize_session=False)
        db.commit()

        # 2. Create required entities
        category = Category(category_name="RBAC Test Category", description="Category for RBAC tests")
        db.add(category)
        
        supplier = Supplier(supplier_name="RBAC Test Supplier", contact_name="John RBAC", email="john@rbac.com", phone="12345", is_active=True)
        db.add(supplier)
        
        warehouse = Warehouse(warehouse_name="RBAC Test Warehouse", location="RBAC Warehouse Location")
        db.add(warehouse)
        
        db.commit()
        db.refresh(category)
        db.refresh(supplier)
        db.refresh(warehouse)

        # Create one pre-existing product for delete and PO tests
        product = Product(
            product_name="RBAC Test Product Pre",
            sku="RBAC-SKU-PRE",
            barcode="RBACBARPRE",
            category_id=category.id,
            selling_price=10.0,
            reorder_level=5,
            unit="pcs",
            is_active=True
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Create inventory
        inventory = Inventory(product_id=product.id, warehouse_id=warehouse.id, quantity=10, quantity_reserved=0)
        db.add(inventory)

        # Create PO
        po = PurchaseOrder(
            po_number="RBAC-PO-001",
            supplier_id=supplier.id,
            warehouse_id=warehouse.id,
            status="PENDING",
            total_amount=100.0
        )
        db.add(po)
        db.commit()
        db.refresh(po)

        po_item = PurchaseOrderItem(purchase_order_id=po.id, product_id=product.id, quantity=10, unit_price=10.0)
        db.add(po_item)
        db.commit()

        return {
            "category_id": category.id,
            "warehouse_id": warehouse.id,
            "supplier_id": supplier.id,
            "product_id": product.id,
            "inventory_id": inventory.id,
            "po_id": po.id
        }
    finally:
        db.close()

def test_rbac_matrix():
    print("Setting up test data...")
    ids = setup_rbac_test_data()
    print("Test data setup complete.")

    # 1. Register users via endpoint
    print("\n--- Testing Registration & Login ---")
    roles = {
        "ADMIN": "admin@test.com",
        "MANAGER": "manager@test.com",
        "STAFF": "staff@test.com"
    }
    
    tokens = {}
    
    for role, email in roles.items():
        # Register
        reg_payload = {
            "full_name": f"{role} User",
            "email": email,
            "password": "password123",
            "role": role
        }
        res = client.post("/auth/register", json=reg_payload)
        assert res.status_code == 200, f"Registration failed for {role}: {res.text}"
        print(f"Registered {role} successfully.")
        
        # Login
        login_data = {
            "username": email,
            "password": "password123"
        }
        res = client.post("/auth/login", data=login_data)
        assert res.status_code == 200, f"Login failed for {role}: {res.text}"
        tokens[role] = res.json()["access_token"]
        print(f"Logged in {role} and retrieved JWT token.")

    # Headers helper
    def get_auth_header(role_name):
        if not role_name:
            return {}
        return {"Authorization": f"Bearer {tokens[role_name]}"}

    print("\n--- Testing Product Creation (STAFF required) ---")
    # No token -> 401
    res = client.post("/products/", json={
        "product_name": "RBAC Test Product New",
        "category_id": ids["category_id"],
        "selling_price": 20.0,
        "reorder_level": 5,
        "unit": "pcs"
    })
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("  [PASSED] Unauthenticated create product blocked (401)")

    # Staff -> 201
    res = client.post("/products/", json={
        "product_name": "RBAC Test Product New Staff",
        "category_id": ids["category_id"],
        "selling_price": 20.0,
        "reorder_level": 5,
        "unit": "pcs",
        "sku": "RBAC-SKU-STAFF",
        "barcode": "RBACBARSTF"
    }, headers=get_auth_header("STAFF"))
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    print("  [PASSED] Staff create product allowed (201)")

    # Manager -> 201
    res = client.post("/products/", json={
        "product_name": "RBAC Test Product New Manager",
        "category_id": ids["category_id"],
        "selling_price": 20.0,
        "reorder_level": 5,
        "unit": "pcs",
        "sku": "RBAC-SKU-MANAGER",
        "barcode": "RBACBARMGR"
    }, headers=get_auth_header("MANAGER"))
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    print("  [PASSED] Manager create product allowed (201)")

    # Admin -> 201
    res = client.post("/products/", json={
        "product_name": "RBAC Test Product New Admin",
        "category_id": ids["category_id"],
        "selling_price": 20.0,
        "reorder_level": 5,
        "unit": "pcs",
        "sku": "RBAC-SKU-ADMIN",
        "barcode": "RBACBARADM"
    }, headers=get_auth_header("ADMIN"))
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    print("  [PASSED] Admin create product allowed (201)")

    print("\n--- Testing Product Deletion (ADMIN required) ---")
    # Create a product specifically for the deletion test
    res = client.post("/products/", json={
        "product_name": "RBAC Test Product Deletable",
        "category_id": ids["category_id"],
        "selling_price": 20.0,
        "reorder_level": 5,
        "unit": "pcs",
        "sku": "RBAC-SKU-DEL",
        "barcode": "RBACBARDEL"
    }, headers=get_auth_header("ADMIN"))
    assert res.status_code == 201
    del_prod_id = res.json()["id"]

    # Staff -> 403
    res = client.delete(f"/products/{del_prod_id}", headers=get_auth_header("STAFF"))
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  [PASSED] Staff delete product blocked (403)")

    # Manager -> 403
    res = client.delete(f"/products/{del_prod_id}", headers=get_auth_header("MANAGER"))
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  [PASSED] Manager delete product blocked (403)")

    # Admin -> 204
    res = client.delete(f"/products/{del_prod_id}", headers=get_auth_header("ADMIN"))
    assert res.status_code == 204, f"Expected 204, got {res.status_code}"
    print("  [PASSED] Admin delete product allowed (204)")

    print("\n--- Testing Inventory Update (STAFF required) ---")
    # Create inventory endpoint check
    # Staff -> 200/201 (actually it returns updated inventory / message depending on endpoint design)
    # We will test update endpoint PUT /inventory/{id}
    res = client.put(f"/inventory/{ids['inventory_id']}", json={
        "product_id": ids["product_id"],
        "warehouse_id": ids["warehouse_id"],
        "quantity_available": 15,
        "quantity_reserved": 0
    }, headers=get_auth_header("STAFF"))
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("  [PASSED] Staff update inventory allowed (200)")

    # Unauthenticated -> 401
    res = client.put(f"/inventory/{ids['inventory_id']}", json={
        "product_id": ids["product_id"],
        "warehouse_id": ids["warehouse_id"],
        "quantity_available": 15,
        "quantity_reserved": 0
    })
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("  [PASSED] Unauthenticated update inventory blocked (401)")

    print("\n--- Testing Purchase Order Approval (MANAGER required) ---")
    # Staff -> 403
    res = client.put(f"/purchase-orders/{ids['po_id']}", json={"status": "COMPLETED"}, headers=get_auth_header("STAFF"))
    assert res.status_code == 403, f"Expected 403, got {res.status_code}"
    print("  [PASSED] Staff PO completion blocked (403)")

    # Manager -> 200
    res = client.put(f"/purchase-orders/{ids['po_id']}", json={"status": "COMPLETED"}, headers=get_auth_header("MANAGER"))
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("  [PASSED] Manager PO completion allowed (200)")

    print("\n--- Clean Up ---")
    db = SessionLocal()
    try:
        db.query(User).filter(User.email.in_(["admin@test.com", "manager@test.com", "staff@test.com"])).delete(synchronize_session=False)
        db.query(InventoryLog).delete(synchronize_session=False)
        db.query(Inventory).delete(synchronize_session=False)
        db.query(PurchaseOrderItem).delete(synchronize_session=False)
        db.query(PurchaseOrder).delete(synchronize_session=False)
        db.query(Product).filter(Product.product_name.like("RBAC Test%")).delete(synchronize_session=False)
        db.query(Category).filter(Category.category_name == "RBAC Test Category").delete(synchronize_session=False)
        db.query(Supplier).filter(Supplier.supplier_name == "RBAC Test Supplier").delete(synchronize_session=False)
        db.query(Warehouse).filter(Warehouse.warehouse_name == "RBAC Test Warehouse").delete(synchronize_session=False)
        db.commit()
        print("Test database cleaned up successfully.")
    finally:
        db.close()

if __name__ == "__main__":
    test_rbac_matrix()
    print("\n✔ All RBAC matrix tests completed successfully!")
