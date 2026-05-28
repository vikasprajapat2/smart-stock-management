from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.rom import Session

from app.database import   get_db

from app.models.production_order import ProductionOrder
from app.models.bom import BOM
from app.models.bom_item import BOMItem
from app.models.inventory import Inventory

from app.schemas.production_order_schema import (ProductionOrderCreate, ProductionOrderResponse)

router = APIRouter(prefix='/production-orders', tags=['Production Orders'])
def create_production_order(order:ProductionOrderCreate, db: Session = Depends(get_db)):
    bom = db.query(BOM).filter(
        BOM.id == order.bom_id
    ).first()

    if not bom:
        raise HTTPException(
            status_code=404,
            detail='BOM not found'
        )
    
    bom_item = db,query(BOMItem).filter(
        BOMItem.bom_id == bom.id
    ).all()

    for item in bom_items:
        Inventory = db.query(Inventory).filter(Inventory.production_id == item.raw_material_id).first()
        required_qty = (
            item.quantity_required * order.quantity_to_produce)
        
        if not Inventory:
            raise HTTPException(
                status_code=404,
                detail=f"Inventory not found for raw material {item.raw_material_id}"
            )
        if inventory.quantity < required_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for raw material {item.raw_material_id}"
            )

    # CONSUME RAW MATERIALS
    for item in bom_items:

        inventory = db.query(Inventory).filter(
            Inventory.product_id == item.raw_material_id
        ).first()

        required_qty = (
            item.quantity_required *
            order.quantity_to_produce
        )

        inventory.quantity -= required_qty

    # ADD FINISHED GOODS
    finished_inventory = db.query(Inventory).filter(
        Inventory.product_id == order.product_id
    ).first()

    if finished_inventory:

        finished_inventory.quantity += order.quantity_to_produce

    else:

        finished_inventory = Inventory(
            product_id=order.product_id,
            warehouse_id=1,
            quantity=order.quantity_to_produce,
            quantity_reserved=0
        )

        db.add(finished_inventory)

    production_order = ProductionOrder(
        product_id=order.product_id,
        bom_id=order.bom_id,
        quantity_to_produce=order.quantity_to_produce,
        status="COMPLETED"
    )

    db.add(production_order)

    db.commit()

    db.refresh(production_order)

    return production_order