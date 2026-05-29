import sys
import os
from decimal import Decimal
from fastapi.testclient import TestClient

# Adjust path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.warehouse import Warehouse
from app.models.inventory import Inventory
from app.models.bom import BOM
from app.models.bom_item import BOMItem
from app.models.production_order import ProductionOrder
from app.models.material_reservation import MaterialReservation
from app.models.purchase_request import PurchaseRequest
from app.models.bom_version import BOMVersion
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.grn import GRN
from app.models.grn_item import GRNItem
from app.models.stock_movement import StockMovement
from app.models.inventory_log import InventoryLog
from app.auth.dependencies import get_current_user

# Create TestClient
client = TestClient(app)

# Override get_current_user dependency to return a test admin user
test_user = None

def override_get_current_user():
    global test_user
    return test_user

app.dependency_overrides[get_current_user] = override_get_current_user

def clean_all_test_data(db):
    db.query(MaterialReservation).delete()
    db.query(PurchaseRequest).delete()
    db.query(GRNItem).delete()
    db.query(GRN).delete()
    db.query(PurchaseOrderItem).delete()
    db.query(PurchaseOrder).delete()
    db.query(StockMovement).delete()
    db.query(InventoryLog).delete()
    db.query(ProductionOrder).delete()
    db.query(BOMItem).delete()
    db.query(BOMVersion).delete()
    db.query(BOM).delete()
    db.query(Inventory).delete()
    db.query(Product).filter(Product.sku.like("API-TEST-%")).delete()
    db.query(Warehouse).filter(Warehouse.warehouse_name == "API-TEST Warehouse").delete()
    db.query(Category).filter(Category.category_name == "API-TEST Category").delete()
    db.query(Supplier).filter(Supplier.supplier_name == "API-TEST Supplier").delete()
    db.query(User).filter(User.email == "apiadmin@keyafusion.com").delete()
    db.commit()

def setup_db(db):
    print("Setting up DB for API tests...")
    Base.metadata.create_all(bind=engine)
    clean_all_test_data(db)

    # Create admin user
    user = User(
        full_name="API Admin",
        email="apiadmin@keyafusion.com",
        password_hash="xyz",
        role="ADMIN",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Set global test_user
    global test_user
    test_user = user

    # Create Category
    cat = Category(category_name="API-TEST Category", description="API BOM category")
    db.add(cat)
    db.commit()
    db.refresh(cat)

    # Create Products
    # Finished Good
    mach = Product(
        product_name="API-TEST Conveyor Machine",
        sku="API-TEST-MACH-01",
        barcode="9999999991",
        category_id=cat.id,
        selling_price=Decimal("2000.00"),
        unit="pcs"
    )
    # Raw Material
    motor = Product(
        product_name="API-TEST Electric Motor",
        sku="API-TEST-MOT-02",
        barcode="9999999992",
        category_id=cat.id,
        selling_price=Decimal("150.00"),
        unit="pcs"
    )
    db.add_all([mach, motor])
    db.commit()
    db.refresh(mach)
    db.refresh(motor)

    # Create or reuse Warehouse
    wh = db.query(Warehouse).first()
    if not wh:
        wh = Warehouse(warehouse_name="API-TEST Warehouse", location="API Test Room")
        db.add(wh)
        db.commit()
        db.refresh(wh)

    # Create Supplier
    sup = Supplier(supplier_name="API-TEST Supplier", contact_name="Sales Manager", email="sales@api-test.com", phone="999999", address="Tech Park", is_active=True)
    db.add(sup)
    db.commit()
    db.refresh(sup)

    # Seed initial stock (1 unit of Motor)
    inv_motor = Inventory(product_id=motor.id, warehouse_id=wh.id, quantity=1, quantity_reserved=0)
    db.add(inv_motor)
    db.commit()

    return {
        "cat": cat,
        "mach": mach,
        "motor": motor,
        "wh": wh,
        "sup": sup
    }

def run_api_crud_tests():
    db = SessionLocal()
    try:
        data = setup_db(db)
        
        # ==========================================
        # 1. BOM CRUD ENDPOINTS
        # ==========================================
        print("\n--- Testing BOM CRUD Endpoints ---")
        
        # POST /boms/ (Create)
        bom_payload = {
            "bom_number": "API-TEST-BOM-001",
            "product_id": data["mach"].id,
            "version": "1.0.0",
            "description": "API Test Conveyor Machine BOM",
            "labor_cost": 50.00,
            "overhead_cost": 25.00,
            "items": [
                {
                    "material_product_id": data["motor"].id,
                    "quantity_required": 2.00,
                    "wastage_percent": 5.00,
                    "unit": "pcs",
                    "remarks": "Heavy duty motor"
                }
            ]
        }
        
        r = client.post("/boms/", json=bom_payload)
        assert r.status_code == 201, f"BOM POST failed: {r.text}"
        bom = r.json()
        bom_id = bom["id"]
        print(f"  [PASSED] POST /boms/ created BOM ID: {bom_id}")
        assert bom["bom_number"] == "API-TEST-BOM-001"
        assert len(bom["items"]) == 1
        assert float(bom["items"][0]["quantity_required"]) == 2.0
        # Cost check: 2 motors * 150 + 5% wastage (15) + 50 labor + 25 overhead = 390
        assert float(bom["total_cost"]) == 390.00

        # GET /boms/ (List)
        r = client.get("/boms/")
        assert r.status_code == 200
        boms_list = r.json()
        assert any(b["id"] == bom_id for b in boms_list)
        print("  [PASSED] GET /boms/ list works")

        # GET /boms/{id} (Retrieve)
        r = client.get(f"/boms/{bom_id}")
        assert r.status_code == 200
        assert r.json()["bom_number"] == "API-TEST-BOM-001"
        print("  [PASSED] GET /boms/{id} retrieve works")

        # PUT /boms/{id} (Update)
        update_payload = {
            "description": "API Test BOM Updated",
            "labor_cost": 60.00,
            "items": [
                {
                    "material_product_id": data["motor"].id,
                    "quantity_required": 3.00, # Increased motor qty to 3
                    "wastage_percent": 0.00,
                    "unit": "pcs"
                }
            ]
        }
        r = client.put(f"/boms/{bom_id}", json=update_payload)
        assert r.status_code == 200, f"BOM PUT failed: {r.text}"
        updated_bom = r.json()
        print("  [PASSED] PUT /boms/{id} update works")
        assert updated_bom["description"] == "API Test BOM Updated"
        # Cost check: 3 motors * 150 + 60 labor + 25 overhead = 535
        assert float(updated_bom["total_cost"]) == 535.00

        # POST /boms/{id}/approve (Approve)
        r = client.post(f"/boms/{bom_id}/approve")
        assert r.status_code == 200
        approved_bom = r.json()
        assert approved_bom["status"] == "APPROVED"
        print("  [PASSED] POST /boms/{id}/approve approval works")

        # GET /boms/{id}/tree (Tree view)
        r = client.get(f"/boms/{bom_id}/tree")
        assert r.status_code == 200
        tree = r.json()
        assert tree["product_name"] == "API-TEST Conveyor Machine"
        assert len(tree["children"]) == 1
        assert tree["children"][0]["product_name"] == "API-TEST Electric Motor"
        print("  [PASSED] GET /boms/{id}/tree tree view works")

        # ==========================================
        # 2. PRODUCTION ORDER ENDPOINTS
        # ==========================================
        print("\n--- Testing Production Order Endpoints ---")
        
        # POST /production-orders/ (Create)
        po_payload = {
            "production_order_number": "API-TEST-PO-001",
            "product_id": data["mach"].id,
            "bom_id": bom_id,
            "quantity_to_produce": 2
        }
        r = client.post("/production-orders/", json=po_payload)
        assert r.status_code == 201, f"Production Order POST failed: {r.text}"
        p_order = r.json()
        po_id = p_order["id"]
        print(f"  [PASSED] POST /production-orders/ created Production Order ID: {po_id}")
        assert p_order["status"] == "DRAFT"

        # GET /production-orders/ (List)
        r = client.get("/production-orders/")
        assert r.status_code == 200
        orders_list = r.json()
        assert any(o["id"] == po_id for o in orders_list)
        print("  [PASSED] GET /production-orders/ list works")

        # GET /production-orders/{id}/check-availability
        # Quantity to produce: 2
        # Requires: 3 motors * 2 = 6 motors
        # Stock: 1 motor available -> Shortage of 5 motors
        r = client.get(f"/production-orders/{po_id}/check-availability")
        assert r.status_code == 200
        avail = r.json()
        assert avail["can_produce"] is False
        assert len(avail["shortages"]) == 1
        assert float(avail["shortages"][0]["shortage_qty"]) == 5.0
        print("  [PASSED] GET /production-orders/{id}/check-availability works")

        # POST /production-orders/{id}/approve (Approve & Reserve stock)
        r = client.post(f"/production-orders/{po_id}/approve")
        assert r.status_code == 200, f"Approve PO failed: {r.text}"
        assert r.json()["status"] == "APPROVED"
        print("  [PASSED] POST /production-orders/{id}/approve works")

        # POST /production-orders/{id}/start (Start production)
        r = client.post(f"/production-orders/{po_id}/start")
        assert r.status_code == 200
        assert r.json()["status"] == "IN_PRODUCTION"
        print("  [PASSED] POST /production-orders/{id}/start works")

        # ==========================================
        # 3. PURCHASE REQUEST ENDPOINTS
        # ==========================================
        print("\n--- Testing Purchase Requisition Endpoints ---")
        
        # GET /purchase-requests/ (List)
        r = client.get("/purchase-requests/")
        assert r.status_code == 200
        pr_list = r.json()
        assert len(pr_list) == 1
        pr_id = pr_list[0]["id"]
        assert pr_list[0]["product_id"] == data["motor"].id
        assert float(pr_list[0]["quantity_required"]) == 5.0
        assert pr_list[0]["status"] == "PENDING"
        print("  [PASSED] GET /purchase-requests/ list & shortage detection works")

        # POST /purchase-requests/{id}/create-po (Promote PR to PO)
        pr_promote_payload = {
            "supplier_id": data["sup"].id,
            "warehouse_id": data["wh"].id
        }
        r = client.post(f"/purchase-requests/{pr_id}/create-po", json=pr_promote_payload)
        assert r.status_code == 200, f"Promote PR failed: {r.text}"
        po_details = r.json()
        print(f"  [PASSED] POST /purchase-requests/{id}/create-po promoted to PO Number: {po_details['po_number']}")
        
        # Check that PR status has updated to PO_CREATED
        r = client.get("/purchase-requests/")
        assert r.json()[0]["status"] == "PO_CREATED"
        print("  [PASSED] Purchase Request status updated to PO_CREATED")

        # ==========================================
        # 4. PRODUCTION COMPLETION
        # ==========================================
        print("\n--- Testing Production Completion ---")
        
        # Make sure stock of Motor is satisfied.
        # Let's adjust stock of motors to 6 to allow production completion
        inv_record = db.query(Inventory).filter(
            Inventory.product_id == data["motor"].id,
            Inventory.warehouse_id == data["wh"].id
        ).first()
        # In Test 5 (Approve), it reserved 1 motor (the only 1 available).
        # We need to satisfy the shortage of 5 motors. We simulate this by changing inventory to 6
        # and reservation to 6.
        inv_record.quantity = 6
        inv_record.quantity_reserved = 6
        
        # Update reservation record as well
        res_record = db.query(MaterialReservation).filter(
            MaterialReservation.production_order_id == po_id,
            MaterialReservation.product_id == data["motor"].id
        ).first()
        res_record.quantity_reserved = Decimal("6.00")
        db.commit()

        # POST /production-orders/{id}/complete
        r = client.post(f"/production-orders/{po_id}/complete")
        assert r.status_code == 200, f"Complete PO failed: {r.text}"
        assert r.json()["status"] == "COMPLETED"
        print("  [PASSED] POST /production-orders/{id}/complete works")

        # Verify stock consumption
        db.refresh(inv_record)
        # 6 motors - 6 consumed = 0 actual, 0 reserved
        assert inv_record.quantity == 0 and inv_record.quantity_reserved == 0
        
        # Verify machine stock increment
        inv_mach = db.query(Inventory).filter(
            Inventory.product_id == data["mach"].id,
            Inventory.warehouse_id == data["wh"].id
        ).first()
        assert inv_mach is not None
        assert inv_mach.quantity == 2
        print("  [PASSED] Component stock consumed and finished good stock incremented via API.")

        # ==========================================
        # 5. DELETE ENDPOINTS & CLEANUP
        # ==========================================
        print("\n--- Testing Deletion & Cleanup ---")
        
        # Try to delete BOM when it is approved
        # It should succeed or fail depending on constraints. Since it was completed, we can delete the test data.
        # First, clean up production order & related objects
        db.query(MaterialReservation).delete()
        db.query(PurchaseRequest).delete()
        db.query(GRNItem).delete()
        db.query(GRN).delete()
        db.query(PurchaseOrderItem).delete()
        db.query(PurchaseOrder).delete()
        db.query(ProductionOrder).delete()
        db.query(BOMVersion).delete()
        db.commit()

        # DELETE /boms/{id}
        r = client.delete(f"/boms/{bom_id}")
        assert r.status_code == 204
        print("  [PASSED] DELETE /boms/{id} works")

        clean_all_test_data(db)
        print("  [PASSED] Database cleaned up successfully.")
        
        print("\n--- ALL API CRUD TESTS PASSED SUCCESSFULLY! ---")

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_api_crud_tests()
