import re
import random
import string
from typing import Optional

def generate_sku(product_name: str, category_name: Optional[str] = None) -> str:
    prefix = ""
    if category_name:
        clean_cat = re.sub(r'[^A-Z0-9]', '', category_name.upper())[:3]
        if clean_cat:
            prefix += clean_cat + "-"
    clean_prod = re.sub(r'[^A-Z0-9]', '', product_name.upper())[:6]
    if not clean_prod:
        clean_prod = "PROD"
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}{clean_prod}-{suffix}"

def generate_barcode() -> str:
    # Generate a random 10-digit barcode string
    return ''.join(random.choices(string.digits, k=10))

def generate_po_number() -> str:
    import datetime
    date_str = datetime.datetime.now().strftime("%Y%m%d")
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"PO-{date_str}-{random_str}"

