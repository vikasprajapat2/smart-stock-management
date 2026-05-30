from fpdf import FPDF
import barcode
from barcode.writer import ImageWriter
import io

# ST-16 Metrics
PAGE_WIDTH = 210.0
PAGE_HEIGHT = 297.0
LBL_WIDTH = 99.1
LBL_HEIGHT = 33.9
MARGIN_TOP = 12.9
MARGIN_LEFT = 4.65
GAP_X = 2.5 # Approximate
GAP_Y = 0

pdf = FPDF(format='A4')
pdf.set_auto_page_break(auto=False)
pdf.add_page()
pdf.set_font('Helvetica', 'B', 10)

product_name = "Super Premium Quality Basmati Rice 5kg"
sku = "PROD-12345"
b_code = "1234567890"

# Generate Barcode Image in memory
rv = io.BytesIO()
Code128 = barcode.get_barcode_class('code128')
# ImageWriter options
options = {
    'write_text': False, # We will write text using FPDF
    'module_width': 0.3,
    'module_height': 8.0,
    'quiet_zone': 2.0,
    'font_size': 0
}
bc = Code128(b_code, writer=ImageWriter())
bc.write(rv, options=options)
rv.seek(0)
barcode_img = rv.getvalue()

for i in range(16):
    col = i % 2
    row = i // 2
    
    x = MARGIN_LEFT + col * (LBL_WIDTH + GAP_X)
    y = MARGIN_TOP + row * (LBL_HEIGHT + GAP_Y)
    
    # Draw border to visualize label
    pdf.rect(x, y, LBL_WIDTH, LBL_HEIGHT)
    
    # Text
    pdf.set_xy(x + 2, y + 2)
    pdf.cell(LBL_WIDTH - 4, 5, text=product_name[:30], align="C")
    
    pdf.set_xy(x + 2, y + 7)
    pdf.set_font('Helvetica', '', 9)
    pdf.cell(LBL_WIDTH - 4, 4, text=f"SKU: {sku}", align="C")
    pdf.set_font('Helvetica', 'B', 10)
    
    # Inject Barcode Image
    # barcode should be placed dynamically
    bc_width = 70
    bc_height = 12
    bc_x = x + (LBL_WIDTH - bc_width) / 2
    bc_y = y + 13
    
    pdf.image(io.BytesIO(barcode_img), x=bc_x, y=bc_y, w=bc_width, h=bc_height)
    
    # Add text below barcode manually
    pdf.set_xy(x + 2, bc_y + bc_height + 1)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(LBL_WIDTH - 4, 4, text=b_code, align="C")

pdf.output('st16_test.pdf')
print('Generated st16_test.pdf')
