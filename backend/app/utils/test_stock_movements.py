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
from app.models.product import Product
from app.models.inventory import Inventory
from app.models.inventory_log import InventoryLog
from app.models.stock_movement import StockMovement
from app.models.notification import Notification

client = TestClient(app)


def setup_test_data():
    db = SessionLocal()
    try:
        # Clean up existing test data
        db.query(StockMovement).delete(synchronize_session=False)
        db.query(User).filter(User.email == "movement_staff@test.com").delete(synchronize_session=False)
        db.query(InventoryLog).delete(synchronize_session=False)
        db.query(Inventory).delete(synchronize_session=False)
        db.query(Notification).delete(synchronize_session=False)
        db.query(Product).filter(Product.product_name.like("Movement Test%")).delete(synchronize_session=False)
        db.query(Category).filter(Category.category_name == "Movement Test Category").delete(synchronize_session=False)
        db.query(Warehouse).filter(Warehouse.warehouse_name.like("Movement Test Warehouse%")).delete(synchronize_session=False)
        db.commit()

        # Create Category
        category = Category(category_name="Movement Test Category", description="Testing Stock Movements")
        db.add(category)
        db.commit()
        db.refresh(category)

        # Create Warehouses
        src_warehouse = Warehouse(warehouse_name="Movement Test Warehouse Src", location="Aisle A")
        dest_warehouse = Warehouse(warehouse_name="Movement Test Warehouse Dest", location="Aisle B")
        db.add(src_warehouse)
        db.add(dest_warehouse)
        db.commit()
        db.refresh(src_warehouse)
        db.refresh(dest_warehouse)

        # Create Product
        product = Product(
            product_name="Movement Test Product",
            sku="MOVE-TEST-001",
            barcode="MOVEBARCODE",
            category_id=category.id,
            selling_price=150.00,
            reorder_level=5,  # Alert when quantity <= 5
            unit="pcs",
            is_active=True
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        return {
            "category_id": category.id,
            "src_warehouse_id": src_warehouse.id,
            "dest_warehouse_id": dest_warehouse.id,
            "product_id": product.id
        }
    finally:
        db.close()


def run_stock_movement_tests():
    print("Setting up test database...")
    ids = setup_test_data()
    print("Test data setup complete.")

    # 1. Register and login test user
    print("\n--- Registering and Logging in Staff User ---")
    reg_payload = {
        "full_name": "Movement Staff User",
        "email": "movement_staff@test.com",
        "password": "password123",
        "role": "STAFF"
    }
    res = client.post("/auth/register", json=reg_payload)
    assert res.status_code == 200, f"Registration failed: {res.text}"

    login_data = {
        "username": "movement_staff@test.com",
        "password": "password123"
    }
    res = client.post("/auth/login", data=login_data)
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("User authenticated successfully.")

    # 2. Test Stock IN
    print("\n--- Testing Stock IN (Endpoint: /stock-movements/in) ---")
    in_payload = {
        "product_id": ids["product_id"],
        "warehouse_id": ids["src_warehouse_id"],
        "quantity": 10,
        "reference": "REF-IN-001",
        "remarks": "Initial stock entry"
    }
    res = client.post("/stock-movements/in", json=in_payload, headers=headers)
    assert res.status_code == 201, f"Expected 210, got {res.status_code}: {res.text}"
    movement_in_id = res.json()["id"]
    print(f"  [PASSED] Stock IN successful. Movement ID: {movement_in_id}")

    # Verify inventory was updated
    db = SessionLocal()
    try:
        inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["src_warehouse_id"]
        ).first()
        assert inv is not None
        assert inv.quantity == 10
        print("  [PASSED] Inventory quantity verified as 10.")

        # Verify InventoryLog was created
        log = db.query(InventoryLog).filter(
            InventoryLog.product_id == ids["product_id"],
            InventoryLog.warehouse_id == ids["src_warehouse_id"],
            InventoryLog.action == "STOCK_IN"
        ).first()
        assert log is not None
        assert log.old_quantity == 0
        assert log.new_quantity == 10
        assert log.quantity_changed == 10
        print("  [PASSED] Inventory log entry verified.")
    finally:
        db.close()

    # 3. Test Stock OUT (Valid)
    print("\n--- Testing Stock OUT (Endpoint: /stock-movements/out) ---")
    out_payload = {
        "product_id": ids["product_id"],
        "warehouse_id": ids["src_warehouse_id"],
        "quantity": 4,
        "reference": "REF-OUT-001",
        "remarks": "Sales dispatch"
    }
    res = client.post("/stock-movements/out", json=out_payload, headers=headers)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    print("  [PASSED] Stock OUT successful.")

    # Verify inventory was updated
    db = SessionLocal()
    try:
        inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["src_warehouse_id"]
        ).first()
        assert inv.quantity == 6
        print("  [PASSED] Inventory quantity verified as 6.")

        # Verify InventoryLog was created
        log = db.query(InventoryLog).filter(
            InventoryLog.product_id == ids["product_id"],
            InventoryLog.warehouse_id == ids["src_warehouse_id"],
            InventoryLog.action == "STOCK_OUT"
        ).first()
        assert log is not None
        assert log.old_quantity == 10
        assert log.new_quantity == 6
        print("  [PASSED] Inventory log entry verified.")
    finally:
        db.close()

    # 4. Test Stock OUT (Insufficient Stock)
    print("\n--- Testing Stock OUT Validation: Insufficient Stock ---")
    invalid_out = {
        "product_id": ids["product_id"],
        "warehouse_id": ids["src_warehouse_id"],
        "quantity": 8,  # only 6 left
        "reference": "REF-OUT-ERR"
    }
    res = client.post("/stock-movements/out", json=invalid_out, headers=headers)
    assert res.status_code == 400
    print("  [PASSED] Stock OUT blocked as expected due to insufficient total stock.")

    # 5. Test Stock OUT (Reserved Stock Validation)
    print("\n--- Testing Stock OUT Validation: Reserved Stock ---")
    # Manually reserve 3 units in DB
    db = SessionLocal()
    try:
        inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["src_warehouse_id"]
        ).first()
        inv.quantity_reserved = 3
        db.commit()
    finally:
        db.close()

    # Try to take out 4 units (total=6, reserved=3, available=3. Requesting 4 should fail)
    res = client.post("/stock-movements/out", json={"product_id": ids["product_id"], "warehouse_id": ids["src_warehouse_id"], "quantity": 4}, headers=headers)
    assert res.status_code == 400
    assert "Insufficient available stock" in res.json()["detail"]
    print("  [PASSED] Stock OUT blocked as expected due to reserved stock constraint.")

    # Try to take out 2 units (available = 3, requesting 2 should succeed)
    res = client.post("/stock-movements/out", json={"product_id": ids["product_id"], "warehouse_id": ids["src_warehouse_id"], "quantity": 2}, headers=headers)
    assert res.status_code == 201
    print("  [PASSED] Stock OUT allowed within available stock limits.")

    # Verify stock is now 4 (reserved = 3, available = 1)
    db = SessionLocal()
    try:
        inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["src_warehouse_id"]
        ).first()
        assert inv.quantity == 4
        print("  [PASSED] Inventory quantity verified as 4.")

        # 6. Test Low Stock Alert notification triggered
        # reorder level is 5. Quantity went from 6 to 4 (which is <= 5).
        # Check if notification was created
        notif = db.query(Notification).filter(Notification.title == "Low Stock Alert").first()
        assert notif is not None
        assert "stock is low" in notif.message
        print("  [PASSED] Low Stock Alert notification successfully verified.")
    finally:
        db.close()

    # 7. Test Warehouse Transfer
    print("\n--- Testing Warehouse Transfer (Endpoint: /stock-movements/transfer) ---")
    transfer_payload = {
        "product_id": ids["product_id"],
        "source_warehouse_id": ids["src_warehouse_id"],
        "destination_warehouse_id": ids["dest_warehouse_id"],
        "quantity": 1,  # available = 1, requesting 1 should succeed
        "reference": "REF-TR-001",
        "remarks": "Inter-warehouse transfer"
    }
    res = client.post("/stock-movements/transfer", json=transfer_payload, headers=headers)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    movements = res.json()
    assert len(movements) == 2
    assert movements[0]["quantity"] == -1
    assert movements[1]["quantity"] == 1
    print("  [PASSED] Warehouse Transfer successful (Two movement records returned).")

    # Verify source & destination inventories
    db = SessionLocal()
    try:
        src_inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["src_warehouse_id"]
        ).first()
        assert src_inv.quantity == 3
        
        dest_inv = db.query(Inventory).filter(
            Inventory.product_id == ids["product_id"],
            Inventory.warehouse_id == ids["dest_warehouse_id"]
        ).first()
        assert dest_inv is not None
        assert dest_inv.quantity == 1
        print("  [PASSED] Source inventory quantity verified as 3, Destination quantity verified as 1.")

        # Verify logs
        logs = db.query(InventoryLog).filter(
            InventoryLog.product_id == ids["product_id"],
            InventoryLog.action.in_(["TRANSFER_OUT", "TRANSFER_IN"])
        ).all()
        assert len(logs) == 2
        print("  [PASSED] Both TRANSFER_IN and TRANSFER_OUT inventory log entries verified.")
    finally:
        db.close()

    # 8. Test Warehouse Transfer Validation: Insufficient Available Stock
    print("\n--- Testing Warehouse Transfer Validation: Insufficient Stock ---")
    # source has 3 units (reserved = 3, available = 0). Requesting 1 should fail.
    res = client.post("/stock-movements/transfer", json={
        "product_id": ids["product_id"],
        "source_warehouse_id": ids["src_warehouse_id"],
        "destination_warehouse_id": ids["dest_warehouse_id"],
        "quantity": 1
    }, headers=headers)
    assert res.status_code == 400
    assert "Insufficient available stock" in res.json()["detail"]
    print("  [PASSED] Transfer blocked correctly due to insufficient available stock.")

    # 9. Test GET endpoints
    print("\n--- Testing GET /stock-movements/ and GET /stock-movements/{id} ---")
    res = client.get("/stock-movements/", headers=headers)
    assert res.status_code == 200
    movements = res.json()
    assert len(movements) >= 4  # IN, OUT, OUT, TRANSFER_OUT, TRANSFER_IN (total 5)
    print(f"  [PASSED] Fetched {len(movements)} movements.")

    # Test filtering
    res = client.get(f"/stock-movements/?warehouse_id={ids['dest_warehouse_id']}", headers=headers)
    assert res.status_code == 200
    dest_movements = res.json()
    assert len(dest_movements) == 1
    assert dest_movements[0]["movement_type"] == "TRANSFER"
    assert dest_movements[0]["quantity"] == 1
    print("  [PASSED] Filtering by warehouse_id works correctly.")

    single_id = dest_movements[0]["id"]
    res = client.get(f"/stock-movements/{single_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == single_id
    print("  [PASSED] Fetching single stock movement by ID works.")

    # Cleanup test data
    print("\n--- Cleaning Up Database ---")
    db = SessionLocal()
    try:
        db.query(StockMovement).delete(synchronize_session=False)
        db.query(User).filter(User.email == "movement_staff@test.com").delete(synchronize_session=False)
        db.query(InventoryLog).delete(synchronize_session=False)
        db.query(Inventory).delete(synchronize_session=False)
        db.query(Notification).delete(synchronize_session=False)
        db.query(Product).filter(Product.product_name.like("Movement Test%")).delete(synchronize_session=False)
        db.query(Category).filter(Category.category_name == "Movement Test Category").delete(synchronize_session=False)
        db.query(Warehouse).filter(Warehouse.warehouse_name.like("Movement Test Warehouse%")).delete(synchronize_session=False)
        db.commit()
        print("Database cleaned up successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    run_stock_movement_tests()
    print("\n✔ All Stock Movement integration tests passed successfully!")
