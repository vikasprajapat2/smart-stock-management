import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, CheckCircle, AlertTriangle,
  Layers, Database, Landmark, Plus, Search, Loader,
  Trash2, Check, AlertCircle, Users, Tag, Edit2, Lock, Unlock, X, Clock,
  Zap, Camera, Activity, Cpu, HardDrive, Wifi, Server, BarChart2
} from 'lucide-react';
import {
  fetchDashboardStats, fetchNotifications, markNotificationRead,
  fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, fetchGSTDetails, fetchSupplierHistory,
  fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, downloadPurchaseOrderPdf, receivePurchaseOrder,
  fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, fetchWarehouseInventory,
  fetchProducts,
  fetchUsers, updateUserRole, deactivateUser, activateUser, deleteUser,
  fetchAllCategories, createCategory, updateCategory, deleteCategory,
  createGRN, createStockMovement, transferStock
} from '../utils/api';
import type {
  Product, Supplier, Warehouse, PurchaseOrderResponse,
  Notification, DashboardStats, User, CategoryResponse, WarehouseInventoryItem
} from '../utils/api';

interface Role {
  id: number;
  role_name: string;
  description?: string;
}

// ─── 1. DASHBOARD VIEW ──────────────────────────────────────

export const DashboardView: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      const [s, a] = await Promise.all([
        fetchDashboardStats(),
        fetchNotifications()
      ]);
      setStats(s);
      setAlerts(a.filter(n => !n.is_read).slice(0, 8)); // Load more alerts
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setAlerts(prev => prev.filter(n => n.id !== id));
      if (stats) {
        setStats({ ...stats, unread_notifications: Math.max(0, stats.unread_notifications - 1) });
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
        <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header Overview */}
      <div className="glass-panel" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>System Dashboard Overview</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>A comprehensive brief of your enterprise resources and real-time operations.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={() => onNavigate('inventory')} className="scan-action-btn btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
            <Plus size={18} /> New Product
          </button>
          <button onClick={() => onNavigate('procurement')} className="scan-action-btn btn-secondary" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
            <ShoppingBag size={18} /> Create PO
          </button>
        </div>
      </div>

      {/* KPI Primary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        
        {/* Products */}
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-cyan)' }} onClick={() => onNavigate('inventory')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Total Products</span>
            <Tag size={20} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{stats?.total_products || 0}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Registered catalog SKUs</p>
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-panel stat-card" style={{ 
          padding: '1.5rem', 
          borderLeft: '4px solid ' + (stats?.low_stock_alerts ? '#ef4444' : '#22c55e'),
          background: stats?.low_stock_alerts ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
        }} onClick={() => onNavigate('inventory')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Low Stock Alerts</span>
            {stats?.low_stock_alerts ? <AlertTriangle size={20} style={{ color: '#ef4444' }} /> : <CheckCircle size={20} style={{ color: '#22c55e' }} />}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: stats?.low_stock_alerts ? '#fca5a5' : 'var(--text-primary)', lineHeight: 1 }}>{stats?.low_stock_alerts || 0}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Items below reorder level</p>
        </div>

        {/* Total Quantity */}
        <div className="glass-panel stat-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-neon)' }} onClick={() => onNavigate('inventoryRecords')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Total Units in Stock</span>
            <Database size={20} style={{ color: 'var(--accent-neon)' }} />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{stats?.total_inventory_quantity || 0}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Across {stats?.total_inventory_records || 0} inventory records</p>
        </div>

        {/* Unread Notifications */}
        <div className="glass-panel stat-card" style={{ 
          padding: '1.5rem', 
          borderLeft: '4px solid ' + (stats?.unread_notifications ? '#fbbf24' : '#64748b')
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Action Items</span>
            <AlertCircle size={20} style={{ color: stats?.unread_notifications ? '#fbbf24' : '#64748b' }} />
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{stats?.unread_notifications || 0}</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>Pending system notifications</p>
        </div>

      </div>

      {/* Secondary Metrics & Logistics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        
        {/* Orders block */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Purchase Orders</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-purple)' }}>{stats?.purchase_orders || 0}</div>
          </div>
          <div style={{ width: '1px', height: '100%', background: 'rgba(0,0,0,0.1)' }}></div>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Sales Orders</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3b82f6' }}>{stats?.sales_orders || 0}</div>
          </div>
        </div>

        {/* Manufacturing block */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>BOM Recipes</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{stats?.total_boms || 0}</div>
          </div>
          <div style={{ width: '1px', height: '100%', background: 'rgba(0,0,0,0.1)' }}></div>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Active Prod. Runs</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ec4899' }}>{stats?.active_production_orders || 0}</div>
          </div>
        </div>

        {/* Logistics block */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Warehouses</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{stats?.total_warehouses || 0}</div>
          </div>
          <div style={{ width: '1px', height: '100%', background: 'rgba(0,0,0,0.1)' }}></div>
          <div style={{ flex: 1 }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Suppliers</div>
             <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6' }}>{stats?.total_suppliers || 0}</div>
          </div>
        </div>

      </div>

      {/* Main Bottom Section: Charts & Feed */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left side: Advanced SVG Micro-Chart & Logs */}
        <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={20} style={{ color: 'var(--accent-cyan)' }} />
            Business Flow & System Performance
          </h3>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Visual SVG Line graph indicating active log flows */}
            <div style={{ position: 'relative', width: '100%', height: '180px', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', padding: '1rem' }}>
              <svg viewBox="0 0 600 150" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="chart-glow2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="chart-glow-purple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity="0.4"/>
                    <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                {/* Gridlines */}
                {[30, 70, 110, 150].map(y => (
                  <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="rgba(0,0,0,0.04)" strokeWidth="1" strokeDasharray="4 4" />
                ))}
                
                {/* INVENTORY FLOW LINE */}
                <path d="M 0 140 L 80 110 L 160 120 L 250 60 L 330 80 L 420 30 L 510 40 L 600 15 L 600 150 L 0 150 Z" fill="url(#chart-glow2)" />
                <path d="M 0 140 L 80 110 L 160 120 L 250 60 L 330 80 L 420 30 L 510 40 L 600 15" fill="none" stroke="var(--accent-cyan)" strokeWidth="3" />
                
                {/* ORDERS FLOW LINE */}
                <path d="M 0 130 L 80 140 L 160 90 L 250 110 L 330 50 L 420 70 L 510 20 L 600 30" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeDasharray="6 4" />
                
                {/* Data Points */}
                {[ {x: 250, y: 60}, {x: 420, y: 30}, {x: 600, y: 15} ].map((pt, i) => (
                  <circle key={i} cx={pt.x} cy={pt.y} r="5" fill="var(--accent-cyan)" stroke="#1a1a2e" strokeWidth="2" />
                ))}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Current</span>
              </div>
            </div>

            {/* Metrics Progress bars */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>Overall Storage Utilization</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>64%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '64%', height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-neon))', borderRadius: '4px' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 600 }}>Order Fulfillment Rate</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>92%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, var(--accent-purple), #ec4899)', borderRadius: '4px' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Warnings / Notifications Feed */}
        <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} style={{ color: '#fbbf24' }} />
              Recent Alerts & Activity
            </h3>
            <span style={{ fontSize: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
              {alerts.length} Pending
            </span>
          </div>

          <div style={{ flex: 1, paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle size={40} style={{ color: 'var(--accent-neon)', margin: '0 auto 1rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>All Clear!</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No pending alerts or notifications.</p>
              </div>
            ) : (
              alerts.map(n => (
                <div key={n.id} style={{ 
                  padding: '1rem', 
                  background: 'rgba(0, 0, 0, 0.02)', 
                  border: '1px solid rgba(0, 0, 0, 0.05)', 
                  borderLeft: `4px solid ${n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#fbbf24' : 'var(--accent-cyan)'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '1rem',
                  transition: 'transform 0.2s',
                  cursor: 'pointer'
                }}>
                  <div style={{ color: n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#fbbf24' : 'var(--accent-cyan)', marginTop: '0.15rem' }}>
                    {n.type === 'error' ? <AlertTriangle size={18} /> : n.type === 'warning' ? <AlertCircle size={18} /> : <div style={{width:'18px', height:'18px', borderRadius:'50%', background:'var(--accent-cyan)', display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width:'6px', height:'6px', background:'var(--text-primary)', borderRadius:'50%'}}></div></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.4' }}>{n.message}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    className="scan-action-btn btn-secondary"
                    style={{ padding: '0.4rem', width: 'auto', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                    title="Acknowledge Alert"
                  >
                    <Check size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};


// Helper Icon Component
const BarChart2Icon = ({ size, style }: any) => (
  <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);


// ─── 2. WAREHOUSE VIEW ──────────────────────────────────────

export const WarehouseView: React.FC<{ userRole?: string }> = ({ userRole = "STAFF" }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWhId, setSelectedWhId] = useState<number | null>(null);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingWhId, setEditingWhId] = useState<number | null>(null);
  const [whName, setWhName] = useState<string>('');
  const [whLocation, setWhLocation] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);

  const [whInventory, setWhInventory] = useState<WarehouseInventoryItem[]>([]);
  const [whInventoryLoading, setWhInventoryLoading] = useState<boolean>(false);

  // Warehouse stock movements / adjustments / transfers states
  const [operationType, setOperationType] = useState<'TRANSFER' | 'ADJUST'>('TRANSFER');
  const [adjustDirection, setAdjustDirection] = useState<'IN' | 'OUT'>('IN');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [refInput, setRefInput] = useState<string>('');
  const [remarksInput, setRemarksInput] = useState<string>('');
  const [opsLoading, setOpsLoading] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [w, p] = await Promise.all([
        fetchWarehouses(),
        fetchProducts()
      ]);
      setWarehouses(w);
      setProducts(p);
      if (w.length > 0 && !selectedWhId) {
        setSelectedWhId(w[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedWhId === null) return;
    
    const loadWhInventory = async () => {
      setWhInventoryLoading(true);
      try {
        const data = await fetchWarehouseInventory(selectedWhId);
        setWhInventory(data.inventory);
      } catch (err: any) {
        console.error(err);
        setErrorMsg('Failed to load warehouse-specific inventory records.');
      } finally {
        setWhInventoryLoading(false);
      }
    };
    
    loadWhInventory();
  }, [selectedWhId]);

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (editingWhId) {
        await updateWarehouse(editingWhId, { warehouse_name: whName, location: whLocation });
        setSuccessMsg('Warehouse updated successfully.');
      } else {
        const newWh = await createWarehouse({ warehouse_name: whName, location: whLocation });
        setSuccessMsg('Warehouse created successfully.');
        setSelectedWhId(newWh.id);
      }
      setWhName('');
      setWhLocation('');
      setShowAddForm(false);
      setEditingWhId(null);
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to save warehouse');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (w: Warehouse, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWhId(w.id);
    setWhName(w.warehouse_name);
    setWhLocation(w.location);
    setShowAddForm(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this warehouse? This may fail if it has inventory or orders attached.')) return;
    try {
      await deleteWarehouse(id);
      setSuccessMsg('Warehouse deleted successfully.');
      if (selectedWhId === id) setSelectedWhId(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete warehouse.');
    }
  };

  const handleInventoryOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWhId) return;
    if (!selectedProductId || parseFloat(quantityInput) <= 0) {
      setErrorMsg('Please select a valid Product and Quantity to adjust.');
      return;
    }
    setOpsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (operationType === 'TRANSFER') {
        if (!targetWarehouseId) {
          setErrorMsg('Please select a target Destination Warehouse hub.');
          setOpsLoading(false);
          return;
        }
        await transferStock({
          product_id: parseInt(selectedProductId),
          source_warehouse_id: selectedWhId,
          destination_warehouse_id: parseInt(targetWarehouseId),
          quantity: parseInt(quantityInput),
          reference: refInput.trim() || undefined,
          remarks: remarksInput.trim() || undefined
        });
        setSuccessMsg(`Inventory stock transferred successfully!`);
      } else {
        await createStockMovement({
          product_id: parseInt(selectedProductId),
          warehouse_id: selectedWhId,
          quantity: parseInt(quantityInput),
          reference: refInput.trim() || undefined,
          remarks: remarksInput.trim() || undefined
        }, adjustDirection.toLowerCase() as 'in' | 'out');
        setSuccessMsg(`Inventory stock adjusted successfully (Stock ${adjustDirection})!`);
      }
      
      // Reset forms
      setSelectedProductId('');
      setTargetWarehouseId('');
      setQuantityInput('1');
      setRefInput('');
      setRemarksInput('');
      
      // Reload inventory data
      const data = await fetchWarehouseInventory(selectedWhId);
      setWhInventory(data.inventory);
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed. Verify inventory levels or safety parameters.');
    } finally {
      setOpsLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
        <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
      </div>
    );
  }

  const selectedWh = warehouses.find(w => w.id === selectedWhId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Landmark size={20} style={{ color: 'var(--accent-cyan)' }} />
          Storage Hub Facilities
        </h3>
        {userRole !== 'staff' && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingWhId(null);
              setWhName('');
              setWhLocation('');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="scan-action-btn btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            {showAddForm ? 'Cancel' : 'Add Warehouse'}
          </button>
        )}
      </div>

      {successMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: 'var(--accent-neon)', fontSize: '0.85rem' }}>
          <Check size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {errorMsg}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSaveWarehouse} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{editingWhId ? 'Edit Warehouse' : 'New Warehouse'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Name</label>
              <input type="text" required className="history-search-input" style={{ width: '100%' }} value={whName} onChange={(e) => setWhName(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>Location</label>
              <input type="text" required className="history-search-input" style={{ width: '100%' }} value={whLocation} onChange={(e) => setWhLocation(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="scan-action-btn btn-primary" style={{ width: '200px', height: '40px' }} disabled={formLoading}>
            {formLoading ? <Loader className="spin-anim" size={16} /> : 'Save Warehouse'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left side: Warehouses Directory */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {warehouses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No warehouses found.</p>
            ) : warehouses.map(w => (
              <div 
                key={w.id} 
                onClick={() => setSelectedWhId(w.id)}
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  background: selectedWhId === w.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(0,0,0,0.01)',
                  border: selectedWhId === w.id ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📦</span>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: selectedWhId === w.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{w.warehouse_name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Location: {w.location}</p>
                  </div>
                </div>
                {userRole !== 'staff' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={(e) => handleEdit(w, e)} className="btn-icon-only" style={{ background: 'transparent', border: 'none', color: '#60a5fa' }} title="Edit">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={(e) => handleDelete(w.id, e)} className="btn-icon-only" style={{ background: 'transparent', border: 'none', color: '#f87171' }} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right side: Selected Warehouse stock */}
        {selectedWh && (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedWh.warehouse_name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Logistics Hub Location: {selectedWh.location}</p>
              </div>
              <span style={{ fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', padding: '0.25rem 0.6rem', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '20px', fontWeight: 700 }}>
                ONLINE STATE
              </span>
            </div>

            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 700 }}>Stored Inventory Catalog (All Products)</h4>
            
            <div style={{ overflowX: 'auto', position: 'relative' }}>
              {whInventoryLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(20,20,30,0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <Loader className="spin-anim" size={24} style={{ color: 'var(--accent-cyan)' }} />
                </div>
              )}
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.02)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Product Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>SKU Code</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Available Stock</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Reserved Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const invItem = whInventory.find(item => item.product_id === p.id);
                    const qty = invItem ? invItem.quantity : 0;
                    const reserved = invItem ? invItem.reserved_quantity : 0;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>{p.product_name}</td>
                        <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.sku}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: qty > 0 ? 'var(--accent-neon)' : 'var(--text-muted)' }}>
                          {qty} {p.unit || 'pcs'}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: reserved > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                          {reserved} {p.unit || 'pcs'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Warehouse Inventory Operations Card */}
            <div style={{ marginTop: '2rem', borderTop: '1px dashed rgba(0,0,0,0.08)', paddingTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} style={{ color: 'var(--accent-purple)' }} />
                Inventory Operations & Movements
              </h4>

              {/* Selector Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '2px', width: 'fit-content', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => { setOperationType('TRANSFER'); setErrorMsg(''); setSuccessMsg(''); }}
                  style={{
                    border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: operationType === 'TRANSFER' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    color: operationType === 'TRANSFER' ? 'var(--accent-purple)' : 'var(--text-muted)'
                  }}
                >
                  Warehouse Transfer
                </button>
                <button
                  type="button"
                  onClick={() => { setOperationType('ADJUST'); setErrorMsg(''); setSuccessMsg(''); }}
                  style={{
                    border: 'none', borderRadius: '6px', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    background: operationType === 'ADJUST' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    color: operationType === 'ADJUST' ? 'var(--accent-purple)' : 'var(--text-muted)'
                  }}
                >
                  Manual Adjustment (IN/OUT)
                </button>
              </div>

              {/* Form panel */}
              <form onSubmit={handleInventoryOperation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px' }}>
                
                {operationType === 'ADJUST' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Adjustment Type</label>
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '2px', borderRadius: '6px', width: 'fit-content' }}>
                      <button
                        type="button"
                        onClick={() => setAdjustDirection('IN')}
                        style={{
                          border: 'none', borderRadius: '4px', padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                          background: adjustDirection === 'IN' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                          color: adjustDirection === 'IN' ? 'var(--accent-neon)' : 'var(--text-muted)'
                        }}
                      >
                        Stock IN (Add)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdjustDirection('OUT')}
                        style={{
                          border: 'none', borderRadius: '4px', padding: '0.3rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                          background: adjustDirection === 'OUT' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                          color: adjustDirection === 'OUT' ? '#f87171' : 'var(--text-muted)'
                        }}
                      >
                        Stock OUT (Deduct)
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Select Product *</label>
                    <select
                      required
                      className="camera-select"
                      style={{ width: '100%', padding: '0.5rem' }}
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">Select Item...</option>
                      {products.filter(p => p.is_active).map(p => (
                        <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  {operationType === 'TRANSFER' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Destination Hub *</label>
                      <select
                        required
                        className="camera-select"
                        style={{ width: '100%', padding: '0.5rem' }}
                        value={targetWarehouseId}
                        onChange={(e) => setTargetWarehouseId(e.target.value)}
                      >
                        <option value="">Select Destination...</option>
                        {warehouses.filter(w => w.id !== selectedWhId).map(w => (
                          <option key={w.id} value={w.id}>{w.warehouse_name} ({w.location})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="history-search-input"
                      style={{ width: '100%' }}
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Slip Reference / Code (Optional)</label>
                    <input
                      type="text"
                      className="history-search-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. TRF-1002, ADJ-DAM"
                      value={refInput}
                      onChange={(e) => setRefInput(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Operations Remarks (Optional)</label>
                    <input
                      type="text"
                      className="history-search-input"
                      style={{ width: '100%' }}
                      placeholder="e.g. Relocating surplus components, damage log count..."
                      value={remarksInput}
                      onChange={(e) => setRemarksInput(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="scan-action-btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', height: '40px', background: 'var(--accent-purple-gradient)' }}
                  disabled={opsLoading}
                >
                  {opsLoading ? <Loader className="spin-anim" size={16} /> : (
                    operationType === 'TRANSFER' ? 'Execute Warehouse Transfer' : `Apply Stock Adjustment (${adjustDirection})`
                  )}
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};


// ─── 3. SUPPLIERS VIEW ──────────────────────────────────────

export const SuppliersView: React.FC<{ userRole?: string }> = ({ userRole = "STAFF" }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Register Supplier states
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [gstin, setGstin] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [contact, setContact] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [gstLoading, setGstLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // History Modal states
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierHistory, setSupplierHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  const loadSuppliers = async () => {
    try {
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHistory = async (s: Supplier) => {
    setSelectedSupplier(s);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    setErrorMsg('');
    setSupplierHistory([]);
    try {
      const data = await fetchSupplierHistory(s.id);
      setSupplierHistory(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to load supplier purchase history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Indian GSTIN Auto-Verification utility
  const handleVerifyGST = async () => {
    if (!gstin.trim() || gstin.length < 10) return;
    setGstLoading(true);
    setErrorMsg('');
    try {
      const details = await fetchGSTDetails(gstin);
      
      // Auto populate verified records
      setName(details.supplier_name);
      setContact(details.contact_name);
      setEmail(details.email);
      setPhone(details.phone);
      setAddress(details.address);
      setSuccessMsg(`GST Registered taxpayer details verified successfully for State: ${details.state}!`);
    } catch (e: any) {
      setErrorMsg(e.message || 'GSTIN verification failed. Ensure valid syntax.');
    } finally {
      setGstLoading(false);
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        supplier_name: name,
        contact_name: contact || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        gst_number: gstin || undefined
      };
      
      if (editingSupplierId) {
        await updateSupplier(editingSupplierId, payload);
        setSuccessMsg('Supplier profile updated successfully!');
      } else {
        await createSupplier(payload);
        setSuccessMsg('Supplier successfully registered in active partner catalog!');
      }
      
      setName('');
      setContact('');
      setEmail('');
      setPhone('');
      setAddress('');
      setGstin('');
      setShowAddForm(false);
      setEditingSupplierId(null);
      await loadSuppliers();
    } catch (e: any) {
      setErrorMsg(e.message || 'Supplier registration/update failed.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (s: Supplier) => {
    setEditingSupplierId(s.id);
    setName(s.supplier_name);
    setContact(s.contact_name || '');
    setEmail(s.email || '');
    setPhone(s.phone || '');
    setAddress(s.address || '');
    setGstin(s.gst_number || '');
    setShowAddForm(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this supplier? Action cannot be undone if no orders are attached.')) return;
    try {
      await deleteSupplier(id);
      setSuccessMsg('Supplier deleted successfully.');
      await loadSuppliers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete supplier.');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchTerm.toLowerCase();
    return (
      s.supplier_name.toLowerCase().includes(q) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.gst_number && s.gst_number.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Search and Action Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search by vendor name, contact or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {userRole !== 'staff' && (
          <button
            onClick={() => {
              const toggled = !showAddForm;
              setShowAddForm(toggled);
              if (!toggled) {
                setEditingSupplierId(null);
                setName('');
                setContact('');
                setEmail('');
                setPhone('');
                setAddress('');
                setGstin('');
              }
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="scan-action-btn btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} />
            {showAddForm ? 'Close Form' : 'Register New Vendor'}
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: 'var(--accent-neon)', fontSize: '0.85rem' }}>
          <Check size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {errorMsg}
        </div>
      )}

      {/* Add/Edit Supplier Form */}
      {showAddForm && (
        <form onSubmit={handleSaveSupplier} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={18} style={{ color: 'var(--accent-cyan)' }} />
            {editingSupplierId ? 'Edit Vendor Profile' : 'Register Business Vendor Profile'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.03)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', fontWeight: 700 }}>
              Verification Wizard (Indian GSTIN Auto-population)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                className="history-search-input"
                style={{ flex: 1 }}
                placeholder="Enter 15-digit Taxpayer GSTIN (e.g. 33DBCPK8087F1ZK)"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                onClick={handleVerifyGST}
                className="scan-action-btn btn-secondary"
                style={{ width: 'auto', padding: '0 1.25rem', height: '42px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                disabled={gstLoading}
              >
                {gstLoading ? <Loader className="spin-anim" size={16} /> : 'Verify & Prefill'}
              </button>
            </div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Automatically fetches legal business entity registry details to bypass manual typing mistakes.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Supplier Name *</label>
              <input
                type="text"
                required
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="Legal Business Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Contact Manager</label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="Manager Name"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Email Address</label>
              <input
                type="email"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="vendor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Phone / Tel</label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="+91-XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Registered Office Address</label>
            <textarea
              className="history-search-input"
              style={{ width: '100%', minHeight: '60px', resize: 'vertical' }}
              placeholder="Corporate Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', height: '44px' }}
            disabled={formLoading}
          >
            {formLoading ? <Loader className="spin-anim" size={18} /> : (editingSupplierId ? 'Update Supplier Profile' : 'Save Supplier Profile')}
          </button>
        </form>
      )}

      {/* Directory Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader className="spin-anim" size={24} style={{ color: 'var(--accent-cyan)' }} />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Supplier Details</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>GSTIN Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Contact Info</th>
                  <th style={{ padding: '1rem', textAlign: 'left' }}>Office Address</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.supplier_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>ID: Supplier-{s.id}</div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {s.gst_number ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                            {s.gst_number}
                          </span>
                          <span style={{ fontSize: '0.65rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '0.15rem 0.35rem', borderRadius: '4px', alignSelf: 'start', fontWeight: 600 }}>
                            VERIFIED TAXPAYER
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Provided</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ color: 'var(--text-primary)' }}>{s.contact_name || 'N/A'}</div>
                      {s.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{s.email}</div>}
                      {s.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.phone}</div>}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.address}>
                      {s.address || 'N/A'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button onClick={() => handleOpenHistory(s)} className="btn-icon-only" style={{ background: 'rgba(167, 139, 250, 0.1)', border: 'none', color: '#a78bfa', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="View Purchase History">
                          <Clock size={16} />
                        </button>
                        {userRole !== 'staff' && (
                          <>
                            <button onClick={() => handleEdit(s)} className="btn-icon-only" style={{ background: 'rgba(96, 165, 250, 0.1)', border: 'none', color: '#60a5fa', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="btn-icon-only" style={{ background: 'rgba(248, 113, 113, 0.1)', border: 'none', color: '#f87171', borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No suppliers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Purchase Order History Modal */}
      {showHistoryModal && selectedSupplier && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Clock size={18} style={{ color: 'var(--accent-purple)' }} />
                  Purchase History
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', margin: 0 }}>Business Partner: {selectedSupplier.supplier_name}</p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedSupplier(null);
                  setSupplierHistory([]);
                }}
                className="btn-icon-only"
                style={{
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '1.5rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {historyLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                  <Loader className="spin-anim" size={28} style={{ color: 'var(--accent-purple)' }} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Retrieving supplier procurement records...</span>
                </div>
              ) : supplierHistory.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Layers size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.2 }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>No purchase orders have been registered with this supplier yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {supplierHistory.map((po: any) => (
                    <div key={po.id} style={{
                      padding: '1rem',
                      background: 'rgba(0, 0, 0, 0.02)',
                      border: '1px solid rgba(0, 0, 0, 0.04)',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{po.po_number}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{new Date(po.order_date).toLocaleDateString()}</span>
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          background: po.status === 'COMPLETED' || po.status === 'RECEIVED' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: po.status === 'COMPLETED' || po.status === 'RECEIVED' ? 'var(--accent-neon)' : '#fbbf24',
                          border: po.status === 'COMPLETED' || po.status === 'RECEIVED' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {po.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {po.items.map((item: any) => (
                          <span key={item.id} style={{
                            background: 'rgba(0,0,0,0.03)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: 'var(--text-secondary)'
                          }}>
                            {item.product_name || 'Product'} (x{item.quantity}) — ₹{Number(item.unit_price).toFixed(2)}
                          </span>
                        ))}
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        borderTop: '1px dashed rgba(0, 0, 0, 0.05)',
                        paddingTop: '0.5rem',
                        marginTop: '0.25rem'
                      }}>
                        <span style={{ color: 'var(--text-muted)' }}>Wh Destination: <strong style={{ color: 'var(--text-primary)' }}>{po.warehouse_name || 'N/A'}</strong></span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Total: ₹{Number(po.total_amount).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


// ─── 4. PURCHASE ORDERS (PROCUREMENT) VIEW ──────────────────

export const PurchaseOrdersView: React.FC = () => {
  const [pos, setPos] = useState<PurchaseOrderResponse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New PO builder states
  const [showBuilder, setShowBuilder] = useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWhId, setSelectedWhId] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [editingPoId, setEditingPoId] = useState<number | null>(null);
  
  // PO items builder
  const [poItems, setPoItems] = useState<Array<{ product_id: number; quantity: number; unit_price: number }>>([]);
  const [builderLoading, setBuilderLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Goods Receipt (GRN) states
  const [showGRNModal, setShowGRNModal] = useState<boolean>(false);
  const [selectedPOForGRN, setSelectedPOForGRN] = useState<PurchaseOrderResponse | null>(null);
  const [grnRemarks, setGrnRemarks] = useState<string>('');
  const [grnItems, setGrnItems] = useState<Array<{ product_id: number; product_name: string; ordered_qty: number; received_qty: number; damaged_qty: number; unit: string }>>([]);
  const [grnWarehouseId, setGrnWarehouseId] = useState<string>('');
  const [grnLoading, setGrnLoading] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const [poData, supData, whData, prodData] = await Promise.all([
        fetchPurchaseOrders(),
        fetchSuppliers(),
        fetchWarehouses(),
        fetchProducts()
      ]);
      setPos(poData);
      setSuppliers(supData);
      setWarehouses(whData);
      setProducts(prodData);
      
      if (supData.length > 0) setSelectedSupplierId(supData[0].id.toString());
      if (whData.length > 0) setSelectedWhId(whData[0].id.toString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = () => {
    if (products.length === 0) return;
    setPoItems([...poItems, { product_id: products[0].id, quantity: 10, unit_price: 10 }]);
  };

  const handleRemoveItem = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, key: string, val: any) => {
    const copy = [...poItems];
    copy[index] = { ...copy[index], [key]: val };
    setPoItems(copy);
  };

  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      setErrorMsg('Add at least one product item to compile Purchase Order.');
      return;
    }

    setBuilderLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        supplier_id: parseInt(selectedSupplierId),
        warehouse_id: selectedWhId ? parseInt(selectedWhId) : undefined,
        status: 'PENDING' as const,
        delivery_date: deliveryDate || undefined,
        items: poItems
      };

      if (editingPoId) {
        await updatePurchaseOrder(editingPoId, payload);
        setSuccessMsg('Procurement Purchase Order updated successfully.');
      } else {
        await createPurchaseOrder(payload);
        setSuccessMsg('Procurement Purchase Order compiled and saved in database as PENDING.');
      }

      setPoItems([]);
      setDeliveryDate('');
      setShowBuilder(false);
      setEditingPoId(null);
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'PO compilation failed.');
    } finally {
      setBuilderLoading(false);
    }
  };

  const handleEditPO = (po: PurchaseOrderResponse) => {
    setEditingPoId(po.id);
    setSelectedSupplierId(po.supplier_id ? po.supplier_id.toString() : '');
    setSelectedWhId(po.warehouse_id ? po.warehouse_id.toString() : '');
    setDeliveryDate(po.delivery_date ? po.delivery_date.split('T')[0] : '');
    setPoItems((po.items || []).map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price || 0
    })));
    setShowBuilder(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenGRNWizard = (po: PurchaseOrderResponse) => {
    setSelectedPOForGRN(po);
    setGrnRemarks('');
    setGrnWarehouseId(po.warehouse_id ? po.warehouse_id.toString() : (warehouses.length > 0 ? warehouses[0].id.toString() : ''));
    
    // Load GRN items
    const items = (po.items || []).map(item => {
      const prodName = products.find(p => p.id === item.product_id)?.product_name || `Product ID: ${item.product_id}`;
      const prodUnit = products.find(p => p.id === item.product_id)?.unit || 'pcs';
      return {
        product_id: item.product_id,
        product_name: prodName,
        ordered_qty: item.quantity,
        received_qty: item.quantity, // default to receiving everything
        damaged_qty: 0,
        unit: prodUnit
      };
    });
    setGrnItems(items);
    setShowGRNModal(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handlePostGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPOForGRN) return;
    if (!grnWarehouseId) {
      setErrorMsg('Select a destination warehouse to register incoming stock.');
      return;
    }
    setGrnLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await createGRN({
        purchase_order_id: selectedPOForGRN.id,
        warehouse_id: parseInt(grnWarehouseId),
        remarks: grnRemarks.trim() || undefined,
        items: grnItems.map(item => ({
          product_id: item.product_id,
          ordered_qty: item.ordered_qty,
          received_qty: item.received_qty,
          damaged_qty: item.damaged_qty
        }))
      });
      
      try {
        await receivePurchaseOrder(selectedPOForGRN.id);
      } catch (err) {
        console.warn('Silent warning: PO status update finished with fallback code', err);
      }

      setSuccessMsg(`Goods Receipt Note posted successfully! Stock added to facility.`);
      setShowGRNModal(false);
      setSelectedPOForGRN(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post Goods Receipt Note.');
    } finally {
      setGrnLoading(false);
    }
  };

  const handleDeletePO = async (id: number) => {
    if (!confirm('Are you sure you want to delete this Purchase Order?')) return;
    try {
      await deletePurchaseOrder(id);
      setSuccessMsg('Purchase Order deleted successfully.');
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to delete PO.');
    }
  };

  const calculateTotal = () => {
    return poItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Procurement & Purchase Invoices</h3>
        <button
          onClick={() => {
            setShowBuilder(!showBuilder);
            if (showBuilder) setEditingPoId(null);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="scan-action-btn btn-primary"
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          {showBuilder ? 'Close PO Builder' : 'Compile Purchase Order'}
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: 'var(--accent-neon)', fontSize: '0.85rem' }}>
          <Check size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
          <AlertCircle size={16} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} /> {errorMsg}
        </div>
      )}

      {/* Procurement PO Builder Form */}
      {showBuilder && (
        <form onSubmit={handleSubmitPO} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
            Procurement PO Compiler
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {/* Supplier select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Select Business Partner (Supplier) *</label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.supplier_name}</option>
                ))}
              </select>
            </div>

            {/* Warehouse select */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Destination Warehouse Hub *</label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={selectedWhId}
                onChange={(e) => setSelectedWhId(e.target.value)}
                required
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Expected Delivery Date</label>
              <input
                type="date"
                className="history-search-input"
                style={{ width: '100%' }}
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          {/* Add product list items */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>Procured Items Catalog</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="scan-action-btn btn-secondary"
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
              >
                + Add Item Line
              </button>
            </div>

            {poItems.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>No item lines compiled yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {poItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    
                    {/* Choose Product */}
                    <select
                      className="camera-select"
                      style={{ padding: '0.55rem 0.65rem', fontSize: '0.8rem' }}
                      value={item.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', parseInt(e.target.value))}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                      ))}
                    </select>

                    {/* Quantity */}
                    <input
                      type="number"
                      min="1"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                    />

                    {/* Unit buying cost */}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                    />

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="btn-icon-only"
                      style={{ border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', width: '32px', height: '32px' }}
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Total Compiled Amount: ₹{calculateTotal().toFixed(2)}
          </div>

          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', height: '44px' }}
            disabled={builderLoading}
          >
            {builderLoading ? <Loader className="spin-anim" size={18} /> : 'Compile & Save Purchase Order'}
          </button>
        </form>
      )}

      {/* PO Listing */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader className="spin-anim" size={24} style={{ color: 'var(--accent-cyan)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pos.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
              <h4>No Purchase Orders Found</h4>
            </div>
          ) : (
            pos.map(po => (
              <div key={po.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.015)' }}>
                {/* Header details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.04)', paddingBottom: '0.75rem', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)', fontWeight: 700 }}>{po.po_number}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Order Date: {new Date(po.order_date).toLocaleDateString()}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      background: po.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.12)' : po.status === 'PENDING' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: po.status === 'COMPLETED' ? 'var(--accent-neon)' : po.status === 'PENDING' ? '#fbbf24' : '#ef4444',
                      border: po.status === 'COMPLETED' ? '1px solid rgba(34, 197, 94, 0.2)' : po.status === 'PENDING' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: 700
                    }}>
                      {po.status}
                    </span>

                    {/* PDF Download Button */}
                    <button
                      onClick={async () => {
                        try {
                          await downloadPurchaseOrderPdf(po.id);
                        } catch (err: any) {
                          alert(err.message || 'Failed to download PDF');
                        }
                      }}
                      className="scan-action-btn btn-secondary"
                      style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.7rem', height: '26px' }}
                    >
                      Download PDF
                    </button>

                    {/* Receive Stock Actions Button */}
                    {po.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleEditPO(po)}
                          className="scan-action-btn btn-secondary"
                          style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.7rem', height: '26px' }}
                        >
                          Edit PO
                        </button>
                        <button
                          onClick={() => handleOpenGRNWizard(po)}
                          className="scan-action-btn btn-primary"
                          style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.7rem', height: '26px' }}
                        >
                          Receive Stock IN
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeletePO(po.id)}
                      className="scan-action-btn btn-secondary"
                      style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.7rem', height: '26px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Details layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Warehouse Hub</label>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{po.warehouse?.warehouse_name || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Supplier Entity</label>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{po.supplier?.supplier_name || 'Seeded Partner'}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Expected Delivery</label>
                    <span>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : 'Immediate'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Invoice Valuation</label>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>₹{Number(po.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Items collapsed layout */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Manifest List</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(po.items || []).map((item, id) => (
                      <span key={id} style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                        {item.product_name || 'Product'} (x{item.quantity}) — ₹{Number(item.unit_price || 0).toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* Transactional Goods Receipt (GRN) Modal */}
      {showGRNModal && selectedPOForGRN && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
          padding: '1rem'
        }}>
          <form onSubmit={handlePostGRN} className="glass-panel" style={{
            position: 'relative',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <button 
              type="button"
              onClick={() => { setShowGRNModal(false); setSelectedPOForGRN(null); }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={18} style={{ color: 'var(--accent-neon)' }} />
                Compile Goods Receipt Note (GRN)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Verify actual physical incoming goods count against PO: <strong>{selectedPOForGRN.po_number}</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Destination Warehouse Hub *</label>
                <select 
                  required 
                  className="camera-select" 
                  style={{ width: '100%', padding: '0.5rem' }} 
                  value={grnWarehouseId} 
                  onChange={(e) => setGrnWarehouseId(e.target.value)}
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name} ({w.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Goods Received By</label>
                <input 
                  type="text" 
                  disabled 
                  className="history-search-input" 
                  style={{ width: '100%', opacity: 0.6 }} 
                  value="Warehouse Manager (System)" 
                />
              </div>
            </div>

            {/* Items Verification Table */}
            <div style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <th style={{ padding: '0.75rem' }}>Incoming Item</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Ordered Qty</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Received Qty *</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Damaged Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {grnItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {item.product_name}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {item.ordered_qty} {item.unit}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number" 
                          required 
                          min="0" 
                          max={item.ordered_qty}
                          className="history-search-input" 
                          style={{ width: '80px', textAlign: 'center', padding: '0.25rem' }} 
                          value={item.received_qty} 
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const updated = [...grnItems];
                            updated[idx].received_qty = val;
                            updated[idx].damaged_qty = Math.max(0, item.ordered_qty - val);
                            setGrnItems(updated);
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number" 
                          required 
                          min="0" 
                          className="history-search-input" 
                          style={{ width: '80px', textAlign: 'center', padding: '0.25rem', color: item.damaged_qty > 0 ? '#f87171' : 'var(--text-muted)' }} 
                          value={item.damaged_qty} 
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            const updated = [...grnItems];
                            updated[idx].damaged_qty = val;
                            setGrnItems(updated);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Arrival Remarks / Notes</label>
              <textarea 
                className="history-search-input" 
                style={{ width: '100%', height: '60px', padding: '0.5rem', resize: 'none' }} 
                placeholder="e.g. Received in good condition, 2 boxes wet during shipping..." 
                value={grnRemarks}
                onChange={(e) => setGrnRemarks(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => { setShowGRNModal(false); setSelectedPOForGRN(null); }}
                className="scan-action-btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>

              <button 
                type="submit" 
                className="scan-action-btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                disabled={grnLoading}
              >
                {grnLoading ? <Loader className="spin-anim" size={16} /> : (
                  <>
                    <span>Post Goods Receipt</span>
                    <CheckCircle size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};


// ─── 5. SALES ORDERS VIEW ───────────────────────────────────

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roles] = useState<Role[]>([
    { id: 1, role_name: 'admin', description: 'System Administrator' },
    { id: 2, role_name: 'manager', description: 'Warehouse Manager' },
    { id: 3, role_name: 'staff', description: 'Scanning Staff' }
  ]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await fetchUsers();
      setUsers(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeRole = async (userId: number, roleId: number) => {
    try {
      await updateUserRole(userId, roleId);
      await loadUsers();
      setEditingRoleId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleToggleStatus = async (userId: number, isActive: boolean) => {
    try {
      if (isActive) {
        await deactivateUser(userId);
      } else {
        await activateUser(userId);
      }
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteUser(userId);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
        <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Users size={20} style={{ color: 'var(--accent-cyan)' }} />
        Team Members ({users.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {users.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
            <h4>No users found</h4>
          </div>
        ) : (
          users.map(user => (
            <div
              key={user.id}
              className="glass-panel"
              style={{
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto auto auto',
                alignItems: 'center',
                gap: '0.75rem',
                borderLeft: `4px solid ${user.is_active ? 'var(--accent-neon)' : '#666'}`,
                opacity: user.is_active ? 1 : 0.6
              }}
            >
              <div style={{ fontSize: '1.5rem' }}>👤</div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user.full_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</div>
              </div>

              {editingRoleId === user.id ? (
                <select
                  value={selectedRoleId || roles.find(r => r.role_name === user.role)?.id || 3}
                  onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                  style={{
                    padding: '0.4rem 0.5rem',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.08)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(0,0,0,0.12)',
                    fontSize: '0.8rem',
                    minWidth: '120px'
                  }}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.role_name}</option>
                  ))}
                </select>
              ) : (
                <span style={{
                  padding: '0.3rem 0.6rem',
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#a78bfa',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}>
                  {user.role || 'Unknown'}
                </span>
              )}

              {editingRoleId === user.id ? (
                <>
                  <button
                    onClick={() => handleChangeRole(user.id, selectedRoleId || roles.find(r => r.role_name === user.role)?.id || 3)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: 'var(--accent-neon)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 600
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingRoleId(null)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: 'rgba(0,0,0,0.05)',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.7rem'
                    }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditingRoleId(user.id);
                    setSelectedRoleId(roles.find(r => r.role_name === user.role)?.id || 3);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    background: 'rgba(0,0,0,0.05)',
                    color: 'var(--text-secondary)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Edit2 size={14} />
                </button>
              )}

              <button
                onClick={() => handleToggleStatus(user.id, user.is_active)}
                style={{
                  padding: '0.4rem 0.6rem',
                  background: user.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: user.is_active ? 'var(--accent-neon)' : '#f87171',
                  border: user.is_active ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {user.is_active ? <Unlock size={14} /> : <Lock size={14} />}
              </button>

              <button
                onClick={() => handleDeleteUser(user.id)}
                style={{
                  padding: '0.4rem 0.6rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─── 7. CATEGORIES MANAGEMENT VIEW ──────────────────────────

export const CategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDesc, setNewCategoryDesc] = useState<string>('');
  const [editingName, setEditingName] = useState<string>('');
  const [editingDesc, setEditingDesc] = useState<string>('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await fetchAllCategories();
      setCategories(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }
    try {
      await createCategory({
        category_name: newCategoryName,
        description: newCategoryDesc
      });
      setNewCategoryName('');
      setNewCategoryDesc('');
      setShowNewForm(false);
      await loadCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: number) => {
    if (!editingName.trim()) {
      setError('Category name is required');
      return;
    }
    try {
      await updateCategory(id, {
        category_name: editingName,
        description: editingDesc
      });
      await loadCategories();
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
        <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
          <p style={{ color: '#fca5a5', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tag size={20} style={{ color: 'var(--accent-purple)' }} />
          Product Categories ({categories.length})
        </h3>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            padding: '0.4rem 0.85rem',
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <Plus size={14} /> New Category
        </button>
      </div>

      {showNewForm && (
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.03)' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Add New Category</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              type="text"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{
                padding: '0.5rem 0.7rem',
                background: 'rgba(0,0,0,0.08)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '4px',
                fontSize: '0.85rem'
              }}
            />
            <textarea
              placeholder="Description (optional)"
              value={newCategoryDesc}
              onChange={(e) => setNewCategoryDesc(e.target.value)}
              style={{
                padding: '0.5rem 0.7rem',
                background: 'rgba(0,0,0,0.08)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '4px',
                fontSize: '0.85rem',
                minHeight: '70px',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleAddCategory}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: 'var(--accent-neon)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  setNewCategoryName('');
                  setNewCategoryDesc('');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(0,0,0,0.05)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {categories.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Tag size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
            <h4>No categories found</h4>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat.id} className="glass-panel" style={{ padding: '1rem' }}>
              {editingId === cat.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    style={{
                      padding: '0.5rem 0.7rem',
                      background: 'rgba(0,0,0,0.08)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}
                  />
                  <textarea
                    value={editingDesc}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    style={{
                      padding: '0.5rem 0.7rem',
                      background: 'rgba(0,0,0,0.08)',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(0,0,0,0.12)',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      minHeight: '70px'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleUpdateCategory(cat.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: 'var(--accent-neon)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        background: 'rgba(0,0,0,0.05)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cat.category_name}</div>
                    {cat.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{cat.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '1rem' }}>
                    <button
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.category_name);
                        setEditingDesc(cat.description || '');
                      }}
                      style={{
                        padding: '0.4rem',
                        background: 'rgba(0,0,0,0.05)',
                        color: 'var(--text-secondary)',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      style={{
                        padding: '0.4rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#fca5a5',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
