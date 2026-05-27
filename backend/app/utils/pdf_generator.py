import io
import re
from datetime import datetime
from decimal import Decimal
from fpdf import FPDF
from app.models.purchase_order import PurchaseOrder

def number_to_words(number):
    """Converts a number to Indian system words format (Lakhs, Thousands)."""
    if number == 0:
        return "Zero"
        
    units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
             "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
    
    def convert_below_thousand(num):
        if num < 20:
            return units[num]
        elif num < 100:
            tens_part = tens[num // 10]
            units_part = units[num % 10]
            return tens_part + (" " + units_part if units_part else "")
        else:
            hundred_part = units[num // 100] + " Hundred"
            rem = num % 100
            return hundred_part + (" " + convert_below_thousand(rem) if rem else "")

    number = int(round(number))
    if number < 0:
        return "Minus " + number_to_words(abs(number))
        
    parts = []
    
    # Crores (1,00,00,000)
    if number >= 10000000:
        crores = number // 10000000
        parts.append(convert_below_thousand(crores) + " Crore")
        number %= 10000000
        
    # Lakhs (1,00,000)
    if number >= 100000:
        lakhs = number // 100000
        parts.append(convert_below_thousand(lakhs) + " Lakh")
        number %= 100000
        
    # Thousands (1,000)
    if number >= 1000:
        thousands = number // 1000
        parts.append(convert_below_thousand(thousands) + " Thousand")
        number %= 1000
        
    # Remaining hundreds
    if number > 0:
        parts.append(convert_below_thousand(number))
        
    res = " ".join(p for p in parts if p)
    return res

def rupees_in_words(num):
    """Wraps number conversion into standard Indian Rupees format."""
    rupees_part = int(num)
    paise_part = int(round((float(num) - rupees_part) * 100))
    
    words = "Rupees " + number_to_words(rupees_part)
    if paise_part > 0:
        words += " and " + number_to_words(paise_part) + " Paise"
    words += " Only"
    return words

def parse_address_metadata(address_str, name=None):
    """Parses GSTIN, PAN, and State details from address text with hardcoded fallbacks."""
    if not address_str:
        address_str = ""
    gstin = ""
    pan = ""
    state_name = "Gujarat"
    state_code = "24"
    
    # 1. Extract GSTIN
    gst_match = re.search(r'(?:GSTIN/UIN|GSTIN)\s*[:\-]?\s*([0-9A-Z]{15})', address_str, re.IGNORECASE)
    if gst_match:
        gstin = gst_match.group(1)
        state_code = gstin[:2]
    else:
        gst_match_gen = re.search(r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b', address_str)
        if gst_match_gen:
            gstin = gst_match_gen.group(1)
            state_code = gstin[:2]

    # 2. Extract PAN
    pan_match = re.search(r'(?:PAN/IT No|PAN)\s*[:\-]?\s*([A-Z]{5}[0-9]{4}[A-Z]{1})', address_str, re.IGNORECASE)
    if pan_match:
        pan = pan_match.group(1)
    else:
        pan_match_gen = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b', address_str)
        if pan_match_gen:
            pan = pan_match_gen.group(1)
            
    # 3. Extract State
    state_match = re.search(r'(?:State Name|State)\s*[:\-]?\s*([A-Za-z\s]+)(?:,\s*Code\s*[:\-]?\s*([0-9]+))?', address_str, re.IGNORECASE)
    if state_match:
        state_name = state_match.group(1).strip()
        if state_match.group(2):
            state_code = state_match.group(2).strip()
    else:
        # Standard Indian state detector fallback
        states_map = {
            "Gujarat": "24",
            "Maharashtra": "27",
            "Delhi": "07",
            "Karnataka": "29",
            "Tamil Nadu": "33",
            "Uttar Pradesh": "09"
        }
        for s, c in states_map.items():
            if s.lower() in address_str.lower():
                state_name = s
                state_code = c
                break
                
    # Clean the address of metadata lines
    clean_lines = []
    for line in address_str.split('\n'):
        line_strip = line.strip()
        if not line_strip:
            continue
        # Skip lines containing metadata keywords
        if (re.search(r'(gstin|pan|state name|state:|code:)', line_strip, re.IGNORECASE) or
            (gstin and gstin in line_strip) or
            (pan and pan in line_strip)):
            continue
        clean_lines.append(line_strip)
    clean_address = ", ".join(clean_lines)
    
    # Fallback to defaults based on template names
    if name:
        name_lower = name.lower()
        if "indiana chem" in name_lower:
            gstin = gstin or "24AAAFI4318M1ZG"
            pan = pan or "AAAFI4318M"
            state_name = "Gujarat"
            state_code = "24"
        elif "keya fusion" in name_lower:
            gstin = gstin or "24AAECK054G1ZZ"
            pan = pan or "AAECK054G"
            state_name = "Gujarat"
            state_code = "24"
            
    return {
        "gstin": gstin,
        "pan": pan,
        "state_name": state_name,
        "state_code": state_code,
        "clean_address": clean_address or address_str
    }

def generate_po_pdf(po: PurchaseOrder) -> bytes:
    """
    Generates a Tally-Style Purchase Order PDF matching the custom grid structure.
    """
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(10, 10, 10)
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)
    
    # Enable black borders
    pdf.set_draw_color(0, 0, 0)
    pdf.set_line_width(0.2)
    
    # --- OUTER BORDER ---
    # Width = 190mm (10 to 200), Height = 277mm (10 to 287)
    pdf.rect(10, 10, 190, 277)
    
    # --- HEADER ---
    pdf.set_xy(10, 10)
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(190, 8, "PURCHASE ORDER", border="B", ln=1, align="C")
    
    # --- ADDRESS PARSING ---
    # 1. Issuer/Buyer (Invoice To) - ALWAYS KEYA FUSION
    issuer_name = "KEYA FUSION TECHNOLOGY PVT LTD"
    issuer_raw_addr = "Plot No. A-7, Prime Industrial Estate, GIDC Savli, Vadodara, Gujarat, 391775"
    issuer_info = parse_address_metadata(issuer_raw_addr, issuer_name)
    
    # 2. Consignee (Ship to) - Selected Warehouse
    consignee_name = po.warehouse.warehouse_name if po.warehouse else "INDIANA CHEM PORT"
    consignee_raw_addr = po.warehouse.location if po.warehouse else "349, G.I.D.C Industrial Estate, Makarpura, Vadodara."
    consignee_info = parse_address_metadata(consignee_raw_addr, consignee_name)
    
    # 3. Supplier (Bill from) - Selected Supplier
    supplier_name = po.supplier.supplier_name if po.supplier else "KEYA FUSION TECHNOLOGY PVT LTD"
    supplier_raw_addr = po.supplier.address if po.supplier else "Plot No. A-7, Prime Industrial Estate, GIDC Savli, Vadodara, Gujarat, 391775"
    supplier_info = parse_address_metadata(supplier_raw_addr, supplier_name)
    
    # Extract destination/city from consignee address for destination and jurisdiction
    addr_text_lower = consignee_raw_addr.lower()
    city_name = "VADODARA"
    for city in ["vadodara", "baroda", "mumbai", "delhi", "bangalore", "chennai", "kolkata", "ahmedabad", "savli", "makarpura"]:
        if city in addr_text_lower:
            city_name = city.upper()
            break
            
    destination_str = "Makarpura"
    if "makarpura" in addr_text_lower:
        destination_str = "Makarpura"
    elif "savli" in addr_text_lower:
        destination_str = "Savli"
    else:
        destination_str = city_name.capitalize()

    # --- TOP GRID ROWS ---
    # Left Column (x = 10 to 110), Right Column (x = 110 to 200)
    # y = 18 to 102
    pdf.line(110, 18, 110, 102) # Main vertical split
    
    # -- LEFT COLUMN --
    # Invoice To: y = 18 to 45
    pdf.set_xy(12, 19)
    pdf.set_font("helvetica", "I", 8)
    pdf.cell(96, 3, "Invoice To", ln=1)
    pdf.set_x(12)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(96, 4.5, issuer_name, ln=1)
    pdf.set_font("helvetica", "", 8)
    # Print address wrapped cleanly
    pdf.set_x(12)
    pdf.multi_cell(96, 3.5, issuer_info["clean_address"])
    
    # GSTIN and State
    pdf.set_xy(12, 37)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(96, 3.5, f"GSTIN/UIN: {issuer_info['gstin']}", ln=1)
    pdf.set_x(12)
    pdf.cell(96, 3.5, f"State Name : {issuer_info['state_name']}, Code : {issuer_info['state_code']}", ln=1)
    
    pdf.line(10, 45, 110, 45) # Horizontal split 1
    
    # Consignee (Ship to): y = 45 to 72
    pdf.set_xy(12, 46)
    pdf.set_font("helvetica", "I", 8)
    pdf.cell(96, 3, "Consignee (Ship to)", ln=1)
    pdf.set_x(12)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(96, 4.5, consignee_name, ln=1)
    pdf.set_font("helvetica", "", 8)
    pdf.set_x(12)
    pdf.multi_cell(96, 3.5, consignee_info["clean_address"])
    
    pdf.set_xy(12, 64)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(96, 3.5, f"GSTIN/UIN: {consignee_info['gstin']}", ln=1)
    pdf.set_x(12)
    pdf.cell(96, 3.5, f"State Name : {consignee_info['state_name']}, Code : {consignee_info['state_code']}", ln=1)
    
    pdf.line(10, 72, 110, 72) # Horizontal split 2
    
    # Supplier (Bill from): y = 72 to 102
    pdf.set_xy(12, 73)
    pdf.set_font("helvetica", "I", 8)
    pdf.cell(96, 3, "Supplier (Bill from)", ln=1)
    pdf.set_x(12)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(96, 4.5, supplier_name, ln=1)
    pdf.set_font("helvetica", "", 8)
    pdf.set_x(12)
    pdf.multi_cell(96, 3.5, supplier_info["clean_address"])
    
    pdf.set_xy(12, 90)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(96, 3.5, f"GSTIN/UIN: {supplier_info['gstin']}", ln=1)
    pdf.set_x(12)
    pdf.cell(96, 3.5, f"PAN/IT No: {supplier_info['pan']}", ln=1)
    pdf.set_x(12)
    pdf.cell(96, 3.5, f"State Name : {supplier_info['state_name']}, Code : {supplier_info['state_code']}", ln=1)
    
    pdf.line(10, 102, 200, 102) # Horizontal table border top
    
    # -- RIGHT COLUMN --
    # Voucher No & Dated: y = 18 to 32
    pdf.set_xy(112, 19)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Voucher No.", ln=1)
    pdf.set_xy(112, 23)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(43, 4.5, po.po_number, ln=1)
    
    pdf.set_xy(157, 19)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Dated", ln=1)
    pdf.set_xy(157, 23)
    pdf.set_font("helvetica", "B", 9)
    order_date_str = po.order_date.strftime("%d-%b-%y") if po.order_date else datetime.now().strftime("%d-%b-%y")
    pdf.cell(43, 4.5, order_date_str, ln=1)
    
    pdf.line(110, 32, 200, 32)
    pdf.line(155, 18, 155, 32)
    
    # Mode/Terms of Payment: y = 32 to 45
    pdf.set_xy(112, 33)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(88, 3.5, "Mode/Terms of Payment", ln=1)
    pdf.set_xy(112, 37)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(88, 4.5, "Immediate", ln=1)
    
    pdf.line(110, 45, 200, 45)
    
    # Reference No. & Date & Other References: y = 45 to 59
    pdf.set_xy(112, 46)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Reference No. & Date", ln=1)
    pdf.set_xy(112, 50)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(43, 4.5, po.po_number, ln=1)
    
    pdf.set_xy(157, 46)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Other References", ln=1)
    
    pdf.line(110, 59, 200, 59)
    pdf.line(155, 45, 155, 59)
    
    # Dispatched through & Destination: y = 59 to 72
    pdf.set_xy(112, 60)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Dispatched through", ln=1)
    pdf.set_xy(112, 64)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(43, 4.5, "Tempo", ln=1)
    
    pdf.set_xy(157, 60)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(43, 3.5, "Destination", ln=1)
    pdf.set_xy(157, 64)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(43, 4.5, destination_str, ln=1)
    
    pdf.line(110, 72, 200, 72)
    pdf.line(155, 59, 155, 72)
    
    # Terms of Delivery: y = 72 to 102
    pdf.set_xy(112, 73)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(88, 3.5, "Terms of Delivery", ln=1)
    pdf.set_xy(112, 78)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(88, 4.5, "Door Delivery", ln=1)
    
    # --- ITEMS TABLE HEADER ---
    # y = 102 to 110
    pdf.set_xy(10, 102)
    pdf.set_font("helvetica", "", 8)
    
    # Col Widths: Sl No (10), No & Kind of Pkgs (18), Description (72), HSN/SAC (18), Qty (18), Rate (22), per (8), Amount (24) = 190
    col_widths = [10, 18, 72, 18, 18, 22, 8, 24]
    headers_first = ["Sl", "No. & Kind", "Description of Goods", "HSN/SAC", "Quantity", "Rate", "per", "Amount"]
    headers_sec = ["No.", "of Pkgs.", "", "", "", "", "", ""]
    
    x_offset = 10
    for w, h1, h2 in zip(col_widths, headers_first, headers_sec):
        pdf.set_xy(x_offset, 102.5)
        pdf.cell(w, 3.5, h1, border=0, align="C")
        if h2:
            pdf.set_xy(x_offset, 106)
            pdf.cell(w, 3.5, h2, border=0, align="C")
        x_offset += w
        
    pdf.line(10, 110, 200, 110)
    
    # --- TABLE VERTICAL LINES ---
    # Body height: y = 110 to 215
    def draw_table_grid():
        pdf.line(10, 110, 10, 215)
        x_line = 10
        for w in col_widths[:-1]:
            x_line += w
            pdf.line(x_line, 110, x_line, 215)
        pdf.line(200, 110, 200, 215)
        
    draw_table_grid()
    
    # --- ITEMS RENDERING ---
    y_ptr = 112
    subtotal = Decimal("0.0")
    total_qty = 0
    
    # Keep track of units for total display
    qty_unit = "Nos"
    
    for idx, item in enumerate(po.items, start=1):
        prod_name = item.product.product_name if item.product else "N/A"
        sku = item.product.sku if item.product else "N/A"
        qty = item.quantity
        price = item.unit_price or Decimal("0.0")
        total = qty * price
        
        subtotal += total
        total_qty += qty
        
        unit = item.product.unit if (item.product and getattr(item.product, 'unit', None)) else "Nos"
        qty_unit = unit
        
        # Determine package info (e.g. 01 Set, or 15 Nos)
        pkg_str = f"{qty:02d} Set" if "machine" in prod_name.lower() or "keyboard" in prod_name.lower() else f"{qty:02d} Nos"
        
        # 1. Sl No.
        pdf.set_xy(10, y_ptr)
        pdf.set_font("helvetica", "", 8.5)
        pdf.cell(col_widths[0], 4, str(idx), align="C")
        
        # 2. No & Kind of Pkgs
        pdf.set_xy(20, y_ptr)
        pdf.cell(col_widths[1], 4, pkg_str, align="C")
        
        # 3. Description
        pdf.set_xy(39, y_ptr)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.cell(71, 4, prod_name)
        
        pdf.set_xy(39, y_ptr + 4)
        pdf.set_font("helvetica", "I", 7.5)
        pdf.cell(71, 3.5, f"As per provided Quotation No. : {1600 + idx}")
        
        # 4. HSN/SAC
        pdf.set_xy(110, y_ptr)
        pdf.set_font("helvetica", "", 8.5)
        hsn_str = "84224000" if "machine" in prod_name.lower() else "84716060"
        pdf.cell(col_widths[3], 4, hsn_str, align="C")
        
        # 5. Quantity
        pdf.set_xy(128, y_ptr)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.cell(col_widths[4], 4, f"{qty} {unit}", align="R")
        
        # 6. Rate
        pdf.set_xy(146, y_ptr)
        pdf.set_font("helvetica", "", 8.5)
        pdf.cell(col_widths[5], 4, f"{price:,.2f}", align="R")
        
        # 7. per
        pdf.set_xy(168, y_ptr)
        pdf.cell(col_widths[6], 4, unit, align="C")
        
        # 8. Amount
        pdf.set_xy(176, y_ptr)
        pdf.set_font("helvetica", "B", 8.5)
        pdf.cell(col_widths[7] - 2, 4, f"{total:,.2f}", align="R")
        
        y_ptr += 11 # advance pointer for next item
        
    # --- TAXES CALCULATION ---
    # If state codes match, CGST (9%) & SGST (9%). Otherwise IGST (18%)
    is_intrastate = (issuer_info["state_code"] == supplier_info["state_code"])
    
    pdf.set_font("helvetica", "B", 8.5)
    if is_intrastate:
        cgst_rate = Decimal("0.09")
        sgst_rate = Decimal("0.09")
        cgst_amt = subtotal * cgst_rate
        sgst_amt = subtotal * sgst_rate
        grand_total = subtotal + cgst_amt + sgst_amt
        
        # CGST line
        pdf.set_xy(39, y_ptr)
        pdf.cell(71, 4, "INPUT TAX CGST A/C", align="R")
        pdf.set_xy(176, y_ptr)
        pdf.cell(col_widths[7] - 2, 4, f"{cgst_amt:,.2f}", align="R")
        
        # SGST line
        y_ptr += 4
        pdf.set_xy(39, y_ptr)
        pdf.cell(71, 4, "INPUT TAX SGST A/C", align="R")
        pdf.set_xy(176, y_ptr)
        pdf.cell(col_widths[7] - 2, 4, f"{sgst_amt:,.2f}", align="R")
    else:
        igst_rate = Decimal("0.18")
        igst_amt = subtotal * igst_rate
        grand_total = subtotal + igst_amt
        
        # IGST line
        pdf.set_xy(39, y_ptr)
        pdf.cell(71, 4, "INPUT TAX IGST A/C", align="R")
        pdf.set_xy(176, y_ptr)
        pdf.cell(col_widths[7] - 2, 4, f"{igst_amt:,.2f}", align="R")
        
    # --- TOTAL ROW ---
    # y = 215 to 223
    pdf.line(10, 215, 200, 215)
    pdf.line(10, 223, 200, 223)
    
    pdf.set_xy(10, 215.5)
    pdf.set_font("helvetica", "", 8.5)
    pdf.cell(100, 7, "Total", align="R")
    
    # Total Qty
    pdf.set_xy(128, 215.5)
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(col_widths[4], 7, f"{total_qty} {qty_unit}", align="R")
    
    # Grand Total
    pdf.set_xy(176, 215.5)
    # Render Rupees prefix
    pdf.cell(col_widths[7] - 2, 7, f"Rs. {grand_total:,.2f}", align="R")
    
    # --- AMOUNT IN WORDS BOX ---
    # y = 223 to 235
    pdf.set_xy(12, 224)
    pdf.set_font("helvetica", "", 7.5)
    pdf.cell(186, 3, "Amount Chargeable (in words)", ln=1)
    pdf.set_x(12)
    pdf.set_font("helvetica", "B", 8.5)
    words_str = rupees_in_words(grand_total)
    pdf.cell(186, 4.5, words_str, ln=1)
    
    pdf.line(10, 235, 200, 235)
    
    # --- BOTTOM SECTIONS ---
    # Left: PAN & Declaration (width 110), Right: Signature (width 80)
    # y = 235 to 277
    pdf.line(120, 235, 120, 277) # split line
    
    # Left Block
    pdf.set_xy(12, 236.5)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(106, 3.5, f"Company's PAN : {issuer_info['pan']}")
    
    pdf.set_xy(12, 241)
    pdf.set_font("helvetica", "BU", 8)
    pdf.cell(106, 3.5, "Declaration", ln=1)
    
    pdf.set_font("helvetica", "", 6.8)
    pdf.set_x(12)
    dec_text = (
        "1. Consignment should accompany Certificate of Analysis/our PO copy/Invoice/waybill.\n"
        "2. Goods Not conforming to our specifications/standard or pre-supply samples are liable\n"
        "to be rejected.\n"
        "3. Raise one invoice against Purchase Order.\n"
        "4. We reserve the right to amend/ cancel this order without notice.\n"
        "5. All suppliers should reach the agreed place of delivery before 4 PM on working days.\n"
        "6. Rejected material shall be collected from our office/factory at your cost immediately\n"
        "after the intimation of the rejection to you.\n"
        "7. Information regarding any shortage/damages will be communicated within 7 days."
    )
    pdf.multi_cell(106, 3.2, dec_text)
    
    # Right Block (Signature)
    pdf.set_xy(122, 236.5)
    pdf.set_font("helvetica", "", 8)
    pdf.cell(76, 3.5, f"for {issuer_name}", align="R", ln=1)
    
    pdf.set_xy(122, 271)
    pdf.set_font("helvetica", "", 8.5)
    pdf.cell(76, 4, "Authorised Signatory", align="R", ln=1)
    
    # --- FOOTER ---
    # Outside box, y = 277 to 287
    pdf.set_xy(10, 278)
    pdf.set_font("helvetica", "B", 7.5)
    jurisdiction_str = f"SUBJECT TO {city_name} JURISDICTION"
    pdf.cell(190, 3.5, jurisdiction_str, align="C", ln=1)
    
    pdf.set_x(10)
    pdf.set_font("helvetica", "I", 7.5)
    pdf.cell(190, 3.5, "This Purchase order is computer generated Document and it does not require a Signature", align="C", ln=1)
    
    return bytes(pdf.output())
