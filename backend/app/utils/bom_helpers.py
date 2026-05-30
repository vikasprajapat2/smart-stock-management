from sqlalchemy.orm import Session
from decimal import Decimal
from sqlalchemy import func
from app.utils.inventory_helpers import (
    log_inventory_change
)

from app.models.bom import BOM
from app.models.bom_item import BOMItem
from app.models.product import Product
from app.models.inventory import Inventory
from app.models.production_order import ProductionOrder
from app.models.material_reservation import MaterialReservation
from app.models.purchase_request import PurchaseRequest

def explode_bom_recursive(db: Session, product_id: int, quantity: Decimal, exploded_materials: dict = None) -> dict:
    """
    Recursively explodes a multi-level BOM for a given product and quantity.
    Returns a dict of {material_product_id: {"quantity": Decimal, "wastage_percent": Decimal}}
    for base-level raw materials (leaf nodes).
    """
    if exploded_materials is None:
        exploded_materials = {}

    # Find the latest approved BOM for this product
    bom = db.query(BOM).filter(
        BOM.product_id == product_id,
        BOM.status == "APPROVED"
    ).order_by(BOM.id.desc()).first()

    if bom:
        # Explode child items
        for item in bom.items:
            item_qty = Decimal(str(item.quantity_required)) * Decimal(str(quantity))
            # Calculate wastage
            wastage = item_qty * (Decimal(str(item.wastage_percent)) / Decimal("100.00"))
            total_item_qty = item_qty + wastage
            
            # Recurse on the child item
            explode_bom_recursive(db, item.material_product_id, total_item_qty, exploded_materials)
    else:
        # Leaf node (base raw material)
        if product_id in exploded_materials:
            exploded_materials[product_id]["quantity"] += Decimal(str(quantity))
        else:
            exploded_materials[product_id] = {
                "quantity": Decimal(str(quantity)),
                "wastage_percent": Decimal("0.00")  # Top-level caller aggregates wastage
            }

    return exploded_materials

def calculate_bom_cost(db: Session, bom: BOM) -> BOM:
    """
    Calculates the total raw material cost of a BOM and updates total_cost.
    """
    raw_material_cost = Decimal("0.00")
    for item in bom.items:
        product = db.query(Product).filter(Product.id == item.material_product_id).first()
        if product:
            price = Decimal(str(product.selling_price or 0.00))
            qty = Decimal(str(item.quantity_required))
            wastage_multiplier = Decimal("1.00") + (Decimal(str(item.wastage_percent)) / Decimal("100.00"))
            raw_material_cost += qty * wastage_multiplier * price

    bom.raw_material_cost = raw_material_cost
    bom.total_cost = raw_material_cost + Decimal(str(bom.labor_cost or 0.00)) + Decimal(str(bom.overhead_cost or 0.00))
    db.commit()
    db.refresh(bom)
    return bom

def check_stock_availability(db: Session, production_order: ProductionOrder, warehouse_id: int = None) -> dict:
    """
    Checks stock availability for all exploded materials required by a production order.
    """
    exploded = explode_bom_recursive(db, production_order.product_id, Decimal(str(production_order.quantity_to_produce)))
    shortages = []
    can_produce = True

    for mat_id, data in exploded.items():
        required_qty = data["quantity"]
        product = db.query(Product).filter(Product.id == mat_id).first()
        
        # Sum quantity in inventory
        inv_query = db.query(Inventory).filter(Inventory.product_id == mat_id)
        if warehouse_id:
            inv_query = inv_query.filter(Inventory.warehouse_id == warehouse_id)
        
        inventories = inv_query.all()
        total_qty = sum(inv.quantity for inv in inventories)
        total_reserved = sum(inv.quantity_reserved for inv in inventories)
        available_qty = Decimal(str(max(0, total_qty - total_reserved)))

        if available_qty < required_qty:
            can_produce = False
            shortage_qty = required_qty - available_qty
            shortages.append({
                "product_id": mat_id,
                "product_name": product.product_name if product else "Unknown Product",
                "sku": product.sku if product else None,
                "required_qty": required_qty,
                "available_qty": available_qty,
                "shortage_qty": shortage_qty
            })

    return {
        "production_order_id": production_order.id,
        "can_produce": can_produce,
        "shortages": shortages
    }

def reserve_stock_for_production(db: Session, production_order: ProductionOrder, warehouse_id: int = None) -> bool:
    """
    Reserves stock for a production order. If shortage is found, reserves available stock
    and generates Purchase Requests for the rest.
    """
    # 1. Explode BOM
    exploded = explode_bom_recursive(db, production_order.product_id, Decimal(str(production_order.quantity_to_produce)))
    
    # Get a warehouse to associate with reservation (default to first active warehouse if none specified)
    if not warehouse_id:
        from app.models.warehouse import Warehouse
        wh = db.query(Warehouse).first()
        warehouse_id = wh.id if wh else 1

    for mat_id, data in exploded.items():
        required_qty = data["quantity"]
        
        # Get inventory record for this product in the selected warehouse
        inv = db.query(Inventory).filter(
            Inventory.product_id == mat_id,
            Inventory.warehouse_id == warehouse_id
        ).first()
        print(
            f"[RESERVE] Product={mat_id}, "
            f"Warehouse={warehouse_id}, "
            f"Inventory={inv.quantity if inv else 0}, "
            f"Reserved={inv.quantity_reserved if inv else 0}, "
            f"Required={required_qty}"
        )

        if not inv:
            # Create empty inventory if it doesn't exist
            inv = Inventory(product_id=mat_id, warehouse_id=warehouse_id, quantity=0, quantity_reserved=0)
            db.add(inv)
            db.flush()

        available_qty = Decimal(
            str(
                max(
                    0,
                    inv.quantity - inv.quantity_reserved
                )
            )
        )

        reserve_qty = min(
            required_qty,
            available_qty
        )

        print(
            f"[AVAILABLE] Product={mat_id}, "
            f"Available={available_qty}, "
            f"ReserveQty={reserve_qty}"
        )

        if reserve_qty > 0:
            inv.quantity_reserved += int(reserve_qty)
            # Create reservation entry
            res = MaterialReservation(
                production_order_id=production_order.id,
                product_id=mat_id,
                quantity_reserved=reserve_qty,
                status="RESERVED"
            )
            db.add(res)
            db.flush()

        # If there is a shortage, create a Purchase Request
        if required_qty > reserve_qty:
            shortage_qty = required_qty - reserve_qty
            pr = PurchaseRequest(
                product_id=mat_id,
                quantity_required=shortage_qty,
                status="PENDING",
                production_order_id=production_order.id
            )
            db.add(pr)
            db.flush()

    db.commit()
    return True

def release_reservations_and_consume_stock(db: Session, production_order: ProductionOrder, warehouse_id: int = None) -> bool:
    """
    Releases reserved stock, decrements inventories of components, and increments stock of the manufactured product.
    """
    if not warehouse_id:
        from app.models.warehouse import Warehouse
        wh = db.query(Warehouse).first()
        warehouse_id = wh.id if wh else 1

    # 1. Consume raw materials/components from reservations
    for res in production_order.reservations:
        if res.status == "RESERVED":
            inv = db.query(Inventory).filter(
                Inventory.product_id == res.product_id,
                # Consume from the warehouse reservation or default
                Inventory.warehouse_id == warehouse_id
            ).first()

            if inv:
                # Decrement actual quantity and reserved quantity
                qty_to_consume = int(res.quantity_reserved)

                old_qty = inv.quantity

                inv.quantity = max(
                    0,
                    inv.quantity - qty_to_consume
                )

                inv.quantity_reserved = max(
                    0,
                    inv.quantity_reserved - qty_to_consume
                )

                log_inventory_change(
                    db=db,
                    product_id=inv.product_id,
                    old_qty=old_qty,
                    new_qty=inv.quantity,
                    action="PRODUCTION_CONSUME"
                )
            
            res.status = "COMPLETED"
            db.flush()

    # 2. Increment stock of finished product
    finished_inv = db.query(Inventory).filter(
        Inventory.product_id == production_order.product_id,
        Inventory.warehouse_id == warehouse_id
    ).first()

    if not finished_inv:
        finished_inv = Inventory(
            product_id=production_order.product_id,
            warehouse_id=warehouse_id,
            quantity=0,
            quantity_reserved=0
        )
        db.add(finished_inv)
        db.flush()

    old_qty = finished_inv.quantity

    finished_inv.quantity += (
        production_order.quantity_to_produce
    )

    log_inventory_change(
        db=db,
        product_id=production_order.product_id,
        old_qty=old_qty,
        new_qty=finished_inv.quantity,
        action="PRODUCTION_OUTPUT"
    )
    db.commit()
    return True
