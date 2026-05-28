import sys
path = r'd:\Keya Work\Bar code scanner\frontend\src\components\ERPViews.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

for comp in ['DashboardView', 'WarehouseView', 'SuppliersView', 'PurchaseOrdersView', 'OrdersView', 'UsersView', 'CategoriesView']:
    old = f'export const {comp}: React.FC = () => {{'
    new = f'export const {comp}: React.FC<{{ userRole?: string }}> = ({{ userRole = "STAFF" }}) => {{'
    content = content.replace(old, new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated ERPViews.tsx component signatures')
