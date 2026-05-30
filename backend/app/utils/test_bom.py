import sys
import os
from decimal import Decimal

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

def setup_test_data(db):
    print("Seeding test data...")
    # 1. Clean up existing test data
    db.query(MaterialReservation).delete()
    db.query(PurchaseRequest).delete()
    db.query(ProductionOrder).delete()
    db.query(BOMItem).delete()
    db.query(BOM).delete()
    db.query(Inventory).delete()
    db.query(Product).filter(Product.sku.like("TEST-%")).delete()
    db.query(Warehouse).filter(Warehouse.warehouse_name == "TEST Warehouse").delete()
    db.query(Category).filter(Category.category_name == "TEST Category").delete()
    db.query(User).filter(User.email == "testadmin@keyafusion.com").delete()
    db.commit()

    # 2. Create test user
    user = User(
        full_name="Test Admin",
        email="testadmin@keyafusion.com",
        password_hash="xyz",
        role="ADMIN",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 3. Create test category
    cat = Category(category_name="TEST Category", description="BOM Test category")
    db.add(cat)
    db.commit()
    db.refresh(cat)

    # 4. Create test products (finished machines, sub-assemblies, raw parts)
    # A: Finished Machine: Robot Arm
    robot = Product(
        product_name="TEST Robot Arm",
        sku="TEST-ROB-001",
        barcode="1111111111",
        category_id=cat.id,
        selling_price=Decimal("1500.00"),
        unit="pcs"
    )
    # B: Sub-Assembly: Control Box
    ctrl_box = Product(
        product_name="TEST Control Box",
        sku="TEST-CTRL-002",
        barcode="2222222222",
        category_id=cat.id,
        selling_price=Decimal("400.00"),
        unit="pcs"
    )
    # C: Raw Component: Microcontroller
    mcu = Product(
        product_name="TEST Microcontroller MCU",
        sku="TEST-MCU-003",
        barcode="3333333333",
        category_id=cat.id,
        selling_price=Decimal("15.00"),
        unit="pcs"
    )
    # D: Raw Component: Cable Harness
    cable = Product(
        product_name="TEST Cable Harness",
        sku="TEST-CAB-004",
        barcode="4444444444",
        category_id=cat.id,
        selling_price=Decimal("8.00"),
        unit="pcs"
    )
    
    db.add_all([robot, ctrl_box, mcu, cable])
    db.commit()
    
    for p in [robot, ctrl_box, mcu, cable]:
        db.refresh(p)

    # 5. Create test warehouse
    wh = Warehouse(warehouse_name="TEST Warehouse", location="Test Section")
    db.add(wh)
    db.commit()
    db.refresh(wh)

    # 6. Seed stock for raw materials (Microcontroller = 10 units, Cable = 5 units)
    # Control Box has NO stock, Robot Arm has NO stock
    inv_mcu = Inventory(product_id=mcu.id, warehouse_id=wh.id, quantity=10, quantity_reserved=0)
    inv_cable = Inventory(product_id=cable.id, warehouse_id=wh.id, quantity=5, quantity_reserved=0)
    db.add_all([inv_mcu, inv_cable])
    db.commit()

    return {
        "admin": user,
        "category": cat,
        "robot": robot,
        "ctrl_box": ctrl_box,
        "mcu": mcu,
        "cable": cable,
        "warehouse": wh
    }

def run_bom_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        data = setup_test_data(db)
        
        # --- TEST 1: Create Multi-Level BOM ---
        print("\nTest 1: Creating BOMs...")
        
        # BOM 1: Control Box requires 1 Microcontroller and 2 Cable Harnesses
        bom_ctrl = BOM(
            bom_number="BOM-CTRL-01",
            product_id=data["ctrl_box"].id,
            version="1.0.0",
            description="Control Box assembly",
            labor_cost=Decimal("20.00"),
            status="APPROVED", # Auto-approve for sub-assembly testing
            approved_by_id=data["admin"].id
        )
        db.add(bom_ctrl)
        db.flush()

        item_ctrl_1 = BOMItem(
            bom_id=bom_ctrl.id,
            material_product_id=data["mcu"].id,
            quantity_required=Decimal("1.00"),
            wastage_percent=Decimal("0.00"),
            unit="pcs"
        )
        item_ctrl_2 = BOMItem(
            bom_id=bom_ctrl.id,
            material_product_id=data["cable"].id,
            quantity_required=Decimal("2.00"),
            wastage_percent=Decimal("10.00"), # 10% wastage
            unit="pcs"
        )
        db.add_all([item_ctrl_1, item_ctrl_2])
        db.commit()
        db.refresh(bom_ctrl)
        
        # BOM 2: Robot Arm requires 1 Control Box (sub-assembly) and 1 Cable Harness
        bom_robot = BOM(
            bom_number="BOM-ROB-01",
            product_id=data["robot"].id,
            version="1.0.0",
            description="Robot Arm assembly",
            labor_cost=Decimal("100.00"),
            overhead_cost=Decimal("50.00"),
            status="APPROVED",
            approved_by_id=data["admin"].id
        )
        db.add(bom_robot)
        db.flush()

        item_robot_1 = BOMItem(
            bom_id=bom_robot.id,
            material_product_id=data["ctrl_box"].id,
            quantity_required=Decimal("1.00"),
            wastage_percent=Decimal("0.00"),
            unit="pcs"
        )
        item_robot_2 = BOMItem(
            bom_id=bom_robot.id,
            material_product_id=data["cable"].id,
            quantity_required=Decimal("1.00"),
            wastage_percent=Decimal("0.00"),
            unit="pcs"
        )
        db.add_all([item_robot_1, item_robot_2])
        db.commit()
        db.refresh(bom_robot)
        
        print("  BOMs created and approved successfully.")

        # --- TEST 2: Cost Calculation ---
        print("\nTest 2: Verifying Cost Calculations...")
        from app.utils.bom_helpers import calculate_bom_cost
        
        calculate_bom_cost(db, bom_ctrl)
        # Cost of Control Box = 1 * MCU (15) + 2 * Cable (8) + 10% wastage on cable (1.6) + labor (20) = 52.6
        print(f"  Control Box calculated total cost: {bom_ctrl.total_cost} (Expected: 52.60)")
        assert abs(bom_ctrl.total_cost - Decimal("52.60")) < Decimal("0.01")
        
        # Update Robot Arm cost: requires 1 Control Box (400 selling_price) + 1 Cable (8) + labor (100) + overhead (50) = 558
        calculate_bom_cost(db, bom_robot)
        print(f"  Robot Arm calculated total cost: {bom_robot.total_cost} (Expected: 558.00)")
        assert abs(bom_robot.total_cost - Decimal("558.00")) < Decimal("0.01")

        # --- TEST 3: Recursive BOM Explosion ---
        print("\nTest 3: Testing BOM Explosion recursion...")
        from app.utils.bom_helpers import explode_bom_recursive
        
        # Explode Robot Arm with quantity = 2
        exploded = explode_bom_recursive(db, data["robot"].id, Decimal("2.00"))
        # 2 Robot Arms require:
        # - 2 Control Boxes (which explode to 2 MCU and 4 Cable + wastage)
        # - 2 Cables (directly from Robot Arm)
        # Net base-level items required:
        # MCU: 2 units
        # Cable: (2 * 2.2 Control Box cables) + 2 Robot Arm cables = 6.4 units
        print(f"  Exploded materials for 2 Robot Arms: {exploded}")
        assert data["mcu"].id in exploded
        assert data["cable"].id in exploded
        assert abs(exploded[data["mcu"].id]["quantity"] - Decimal("2.00")) < Decimal("0.01")
        assert abs(exploded[data["cable"].id]["quantity"] - Decimal("6.40")) < Decimal("0.01")
        print("  [PASSED] Recursion correctly resolved component sub-assemblies and wastage.")

        # --- TEST 4: Stock Availability & Shortage Detection ---
        print("\nTest 4: Checking stock availability...")
        from app.utils.bom_helpers import check_stock_availability
        
        # Create production order for 2 Robot Arms
        po = ProductionOrder(
            production_order_number="PO-ROB-001",
            product_id=data["robot"].id,
            bom_id=bom_robot.id,
            quantity_to_produce=2,
            status="DRAFT"
        )
        db.add(po)
        db.commit()
        db.refresh(po)

        availability = check_stock_availability(db, po, warehouse_id=data["warehouse"].id)
        print(f"  Availability result: {availability}")
        # Stock: MCU = 10 (needs 2, no shortage)
        # Stock: Cable = 5 (needs 6.4, shortage of 1.4)
        assert availability["can_produce"] is False
        assert len(availability["shortages"]) == 1
        assert availability["shortages"][0]["product_id"] == data["cable"].id
        assert abs(availability["shortages"][0]["shortage_qty"] - Decimal("1.40")) < Decimal("0.01")
        print("  [PASSED] Shortage of Cable Harness correctly detected.")

        # --- TEST 5: Stock Reservation & Purchase Request ---
        print("\nTest 5: Approving Production Order & Reserving Stock...")
        from app.utils.bom_helpers import reserve_stock_for_production
        
        reserve_stock_for_production(db, po, warehouse_id=data["warehouse"].id)
        po.status = "APPROVED"
        db.commit()
        db.refresh(po)
        
        # Check reservations
        reservations = db.query(MaterialReservation).filter(MaterialReservation.production_order_id == po.id).all()
        print(f"  Created reservations: {[(r.product.product_name, r.quantity_reserved) for r in reservations]}")
        # MCU: needs 2, should reserve 2
        # Cable: needs 6.4, should reserve all 5 available
        assert len(reservations) == 2
        res_mcu = next(r for r in reservations if r.product_id == data["mcu"].id)
        res_cable = next(r for r in reservations if r.product_id == data["cable"].id)
        assert abs(res_mcu.quantity_reserved - Decimal("2.00")) < Decimal("0.01")
        assert abs(res_cable.quantity_reserved - Decimal("5.00")) < Decimal("0.01")

        # Check inventory reserves
        inv_mcu = db.query(Inventory).filter(Inventory.product_id == data["mcu"].id, Inventory.warehouse_id == data["warehouse"].id).first()
        inv_cable = db.query(Inventory).filter(Inventory.product_id == data["cable"].id, Inventory.warehouse_id == data["warehouse"].id).first()
        assert inv_mcu.quantity_reserved == 2
        assert inv_cable.quantity_reserved == 5

        # Check Purchase Request generated
        prs = db.query(PurchaseRequest).filter(PurchaseRequest.production_order_id == po.id).all()
        print(f"  Created purchase requests: {[(p.product.product_name, p.quantity_required) for p in prs]}")
        assert len(prs) == 1
        assert prs[0].product_id == data["cable"].id
        assert abs(prs[0].quantity_required - Decimal("1.40")) < Decimal("0.01")
        print("  [PASSED] Reservations and Purchase Request created successfully.")

        # --- TEST 6: Production Completion & Stock Consumption ---
        print("\nTest 6: Completing Production Order...")
        from app.utils.bom_helpers import release_reservations_and_consume_stock
        
        # Receive the shortage first to satisfy completion stock logic if necessary,
        # or simply test completion. We will simulate completion.
        release_reservations_and_consume_stock(db, po, warehouse_id=data["warehouse"].id)
        po.status = "COMPLETED"
        db.commit()
        db.refresh(po)

        # Check inventory values after completion:
        # MCU: old actual = 10, consumed = 2 -> new actual = 8, reserved = 0
        # Cable: old actual = 5, consumed = 5 -> new actual = 0, reserved = 0
        # Robot Arm (finished): old actual = 0, produced = 2 -> new actual = 2, reserved = 0
        inv_mcu = db.query(Inventory).filter(Inventory.product_id == data["mcu"].id, Inventory.warehouse_id == data["warehouse"].id).first()
        inv_cable = db.query(Inventory).filter(Inventory.product_id == data["cable"].id, Inventory.warehouse_id == data["warehouse"].id).first()
        inv_robot = db.query(Inventory).filter(Inventory.product_id == data["robot"].id, Inventory.warehouse_id == data["warehouse"].id).first()
        
        print(f"  Final Stock MCU: actual={inv_mcu.quantity}, reserved={inv_mcu.quantity_reserved}")
        print(f"  Final Stock Cable: actual={inv_cable.quantity}, reserved={inv_cable.quantity_reserved}")
        print(f"  Final Stock Robot Arm: actual={inv_robot.quantity}, reserved={inv_robot.quantity_reserved}")
        
        assert inv_mcu.quantity == 8 and inv_mcu.quantity_reserved == 0
        assert inv_cable.quantity == 0 and inv_cable.quantity_reserved == 0
        assert inv_robot.quantity == 2 and inv_robot.quantity_reserved == 0
        print("  [PASSED] Component stock consumed and finished product stock incremented successfully.")
        
        print("\n--- ALL BOM INTEGRATION TESTS PASSED SUCCESSFULLY! ---")

    except Exception as e:
        db.rollback()
        print("Test Failure Error:", e)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_bom_tests()
