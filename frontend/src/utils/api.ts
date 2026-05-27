import axios from 'axios';

// Dynamically determine the base URL
// In development: always talk to FastAPI on port 8000
// In production (same host): use relative path ''
const isDev = import.meta.env.DEV;
export const API_BASE = isDev ? 'http://localhost:8000' : '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add a response interceptor to handle 401 Unauthorized errors
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-unauthorized'));
  }
  return Promise.reject(error);
});

// Authenticated fetch wrapper for other API functions
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const res = await fetch(url, { ...options, headers });
  
  if (res.status === 401) {
    localStorage.removeItem('access_token');
    window.dispatchEvent(new Event('auth-unauthorized'));
  }
  
  return res;
}

export interface Warehouse {
  id: number;
  warehouse_name: string;
  location: string;
}

export interface Category {
  id: number;
  category_name: string;
  description?: string;
}

export interface Product {
  id: number;
  product_name: string;
  sku: string;
  barcode: string;
  category_id?: number;
  selling_price?: number;
  reorder_level?: number;
  unit?: string;
  is_active: boolean;
  stock_quantity: number;
  category?: Category;
}

export interface ProductCreateInput {
  product_name: string;
  sku?: string;
  barcode?: string;
  category_id?: number;
  selling_price?: number;
  reorder_level?: number;
  unit?: string;
  is_active?: boolean;
}

export interface ScanRequest {
  barcode: string;
  action: 'IN' | 'OUT';
  warehouse_id: number;
  quantity: number;
}

export interface ScanResponse {
  product_name: string;
  sku: string;
  barcode: string;
  warehouse_id: number;
  quantity: number;
  action: 'IN' | 'OUT';
  message: string;
}

// Supplier Interfaces
export interface Supplier {
  id: number;
  supplier_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  is_active: boolean;
}

export interface SupplierCreateInput {
  supplier_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  is_active?: boolean;
}

export interface GSTDetails {
  supplier_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  state: string;
}

// Purchase Order Interfaces
export interface PurchaseOrderItemCreate {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface PurchaseOrderItemResponse {
  id: number;
  product_id: number;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export interface PurchaseOrderCreateInput {
  supplier_id: number;
  warehouse_id?: number;
  status?: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  delivery_date?: string;
  items: PurchaseOrderItemCreate[];
}

export interface PurchaseOrderResponse {
  id: number;
  po_number: string;
  supplier_id: number;
  warehouse_id?: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  order_date: string;
  delivery_date?: string;
  total_amount: number;
  supplier?: Supplier;
  warehouse?: Warehouse;
  items: PurchaseOrderItemResponse[];
}

// Sales Order Interfaces
export interface SalesOrderItemCreate {
  product_id: number;
  quantity: number;
  price: number;
}

export interface SalesOrderItemResponse {
  id: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  price: number;
}

export interface SalesOrderCreateInput {
  customer_name: string;
  total_amount: number;
  status: string; // e.g. "COMPLETED"
  items: SalesOrderItemCreate[];
}

export interface SalesOrderResponse {
  id: number;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: SalesOrderItemResponse[];
}

// Notification Interfaces
export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  created_at: string;
}

// Dashboard Interfaces
export interface DashboardStats {
  total_products: number;
  total_inventory: number;
  unread_notifications: number;
  purchase_orders: number;
}


// ─── API FETCH FUNCTIONS ───────────────────────────────────

// Check backend connectivity
export async function checkBackendConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Fetch all warehouses
export async function fetchWarehouses(): Promise<Warehouse[]> {
  const res = await fetchWithAuth(`${API_BASE}/warehouses/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch warehouses');
  }
  return res.json();
}

// Fetch all categories
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetchWithAuth(`${API_BASE}/categories/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch categories');
  }
  return res.json();
}

// Fetch all products
export async function fetchProducts(search?: string): Promise<Product[]> {
  let url = `${API_BASE}/products/`;
  if (search) {
    url += `?search=${encodeURIComponent(search)}`;
  }
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch products');
  }
  return res.json();
}

// Add a new product
export async function createProduct(productData: ProductCreateInput): Promise<Product> {
  const res = await fetchWithAuth(`${API_BASE}/products/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create product');
  }
  return res.json();
}

// Submit a product barcode scan (IN/OUT)
export async function submitProductScan(scanData: ScanRequest): Promise<ScanResponse> {
  const res = await fetchWithAuth(`${API_BASE}/products/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scanData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to process inventory scan');
  }
  return res.json();
}

// ─── SUPPLIER FUNCTIONS ────────────────────────────────────

export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  let url = `${API_BASE}/suppliers/`;
  if (search) {
    url += `?search=${encodeURIComponent(search)}`;
  }
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch suppliers');
  }
  return res.json();
}

export async function createSupplier(supplier: SupplierCreateInput): Promise<Supplier> {
  const res = await fetchWithAuth(`${API_BASE}/suppliers/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(supplier)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create supplier');
  }
  return res.json();
}

export async function fetchGSTDetails(gstin: string): Promise<GSTDetails> {
  const res = await fetchWithAuth(`${API_BASE}/suppliers/fetch-gst/${encodeURIComponent(gstin)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to verify GST number');
  }
  return res.json();
}

export async function fetchSupplierHistory(id: number): Promise<any[]> {
  const res = await fetchWithAuth(`${API_BASE}/suppliers/${id}/history`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch supplier order history');
  }
  return res.json();
}

// ─── PURCHASE ORDERS (PROCUREMENT) ─────────────────────────

export async function fetchPurchaseOrders(): Promise<PurchaseOrderResponse[]> {
  const res = await fetchWithAuth(`${API_BASE}/purchase-orders/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch purchase orders');
  }
  return res.json();
}

export async function createPurchaseOrder(po: PurchaseOrderCreateInput): Promise<PurchaseOrderResponse> {
  const res = await fetchWithAuth(`${API_BASE}/purchase-orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(po)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create purchase order');
  }
  return res.json();
}

export async function updatePurchaseOrder(id: number, status: 'PENDING' | 'COMPLETED' | 'CANCELLED', warehouseId?: number): Promise<PurchaseOrderResponse> {
  const payload: any = { status };
  if (warehouseId !== undefined) {
    payload.warehouse_id = warehouseId;
  }
  const res = await fetchWithAuth(`${API_BASE}/purchase-orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update purchase order');
  }
  return res.json();
}

// ─── SALES ORDERS ──────────────────────────────────────────

export async function fetchOrders(): Promise<SalesOrderResponse[]> {
  const res = await fetchWithAuth(`${API_BASE}/orders/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch sales orders');
  }
  return res.json();
}

export async function createOrder(order: SalesOrderCreateInput): Promise<SalesOrderResponse> {
  const res = await fetchWithAuth(`${API_BASE}/orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit sales order');
  }
  return res.json();
}

// ─── NOTIFICATIONS ─────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetchWithAuth(`${API_BASE}/notifications/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch notifications');
  }
  return res.json();
}

export async function markNotificationRead(id: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/notifications/${id}/read`, {
    method: 'PUT'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to mark notification as read');
  }
  return res.json();
}

// ─── DASHBOARD STATS ───────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetchWithAuth(`${API_BASE}/dashboard/stats`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch dashboard stats');
  }
  return res.json();
}

// ─── USERS MANAGEMENT ───────────────────────────────────────

export interface User {
  id: number;
  full_name: string;
  email: string;
  role_id: number;
  role?: { id: number; role_name: string; description: string };
  is_active: boolean;
}

export interface Role {
  id: number;
  role_name: string;
  description: string;
}

export interface UserCreateInput {
  full_name: string;
  email: string;
  password: string;
  role_id: number;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await fetchWithAuth(`${API_BASE}/users/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch users');
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await fetchWithAuth(`${API_BASE}/users/me`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch current user');
  }
  return res.json();
}

export async function fetchUserById(userId: number): Promise<User> {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch user');
  }
  return res.json();
}

export async function updateUserRole(userId: number, roleId: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}/role?role_id=${roleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update user role');
  }
  return res.json();
}

export async function deactivateUser(userId: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}/deactivate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to deactivate user');
  }
  return res.json();
}

export async function activateUser(userId: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}/activate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to activate user');
  }
  return res.json();
}

export async function deleteUser(userId: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/users/${userId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete user');
  }
  return res.json();
}

// ─── CATEGORIES MANAGEMENT ──────────────────────────────────

export interface CategoryResponse {
  id: number;
  category_name: string;
  description?: string;
}

export interface CategoryCreateInput {
  category_name: string;
  description?: string;
}

export interface CategoryUpdateInput {
  category_name?: string;
  description?: string;
}

export async function fetchAllCategories(): Promise<CategoryResponse[]> {
  const res = await fetchWithAuth(`${API_BASE}/categories/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch categories');
  }
  return res.json();
}

export async function fetchCategoryById(id: number): Promise<CategoryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/categories/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fetch category');
  }
  return res.json();
}

export async function createCategory(categoryData: CategoryCreateInput): Promise<CategoryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/categories/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create category');
  }
  return res.json();
}

export async function updateCategory(id: number, categoryData: CategoryUpdateInput): Promise<CategoryResponse> {
  const res = await fetchWithAuth(`${API_BASE}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update category');
  }
  return res.json();
}

export async function deleteCategory(id: number): Promise<any> {
  const res = await fetchWithAuth(`${API_BASE}/categories/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete category');
  }
  return res.json();
}
