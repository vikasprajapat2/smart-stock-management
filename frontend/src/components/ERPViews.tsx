import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, CheckCircle, AlertTriangle, 
  Layers, Database, Landmark, Plus, Search, Loader, 
  Trash2, Check, AlertCircle
} from 'lucide-react';
import { 
  fetchDashboardStats, fetchNotifications, markNotificationRead,
  fetchSuppliers, createSupplier, fetchGSTDetails,
  fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder,
  fetchOrders, createOrder, fetchWarehouses, fetchProducts
} from '../utils/api';
import type { 
  Product, Supplier, Warehouse, PurchaseOrderResponse, 
  SalesOrderResponse, Notification, DashboardStats 
} from '../utils/api';

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
      setAlerts(a.filter(n => !n.is_read).slice(0, 5));
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Quick stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        
        {/* Total Products */}
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-cyan)' }} onClick={() => onNavigate('inventory')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Catalog Items</span>
            <ShoppingBag size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{stats?.total_products || 0}</div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Active database SKUs</p>
        </div>

        {/* Total Inventory */}
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-neon)' }} onClick={() => onNavigate('warehouse')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Total Warehouses</span>
            <Database size={18} style={{ color: 'var(--accent-neon)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{stats?.total_inventory || 0}</div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Active storage units</p>
        </div>

        {/* Procurement POs */}
        <div className="glass-panel stat-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-purple)' }} onClick={() => onNavigate('procurement')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Procurements</span>
            <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{stats?.purchase_orders || 0}</div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Purchase orders seeded</p>
        </div>

        {/* System Warnings */}
        <div className="glass-panel stat-card" style={{ 
          padding: '1.25rem', 
          borderLeft: '4px solid ' + (stats?.unread_notifications ? '#fbbf24' : '#22c55e'),
          background: stats?.unread_notifications ? 'rgba(251, 191, 36, 0.02)' : 'transparent'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Stock Alerts</span>
            {stats?.unread_notifications ? (
              <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            ) : (
              <CheckCircle size={18} style={{ color: '#22c55e' }} />
            )}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>{stats?.unread_notifications || 0}</div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {stats?.unread_notifications ? 'Action items required' : 'Inventory status optimal'}
          </p>
        </div>

      </div>

      {/* Main dashboard content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left side: SVG Micro-Charts */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2Icon size={18} style={{ color: 'var(--accent-cyan)' }} />
            System Performance & Logistics Flow
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Visual SVG Line graph indicating active log flows */}
            <div style={{ position: 'relative', width: '100%', height: '140px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', padding: '0.5rem' }}>
              <svg viewBox="0 0 500 120" style={{ width: '100%', height: '100%' }}>
                <defs>
                  <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0"/>
                  </linearGradient>
                </defs>
                {/* Gridlines */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                
                {/* Area under the line */}
                <path d="M 0 110 L 50 85 L 120 95 L 200 45 L 280 65 L 360 25 L 430 35 L 500 15 L 500 120 L 0 120 Z" fill="url(#chart-glow)" />
                
                {/* Main line */}
                <path d="M 0 110 L 50 85 L 120 95 L 200 45 L 280 65 L 360 25 L 430 35 L 500 15" fill="none" stroke="var(--accent-cyan)" strokeWidth="2.5" />
                
                {/* Dots */}
                <circle cx="200" cy="45" r="4" fill="var(--accent-cyan)" stroke="#fff" strokeWidth="1" />
                <circle cx="360" cy="25" r="4" fill="var(--accent-cyan)" stroke="#fff" strokeWidth="1" />
                <circle cx="500" cy="15" r="4" fill="var(--accent-cyan)" stroke="#fff" strokeWidth="1" />
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>Q1</span>
                <span>Q2</span>
                <span>Q3</span>
                <span>Current Week</span>
              </div>
            </div>

            {/* Logistics Status Indicator bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>Warehouse Storage Level</span>
                  <span>78%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-neon))', borderRadius: '3px' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  <span>Procurements Completed</span>
                  <span>92%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', background: 'linear-gradient(90deg, var(--accent-purple), var(--accent-neon))', borderRadius: '3px' }}></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right side: Warnings / Notifications log */}
        <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '300px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            Critical Stock Warnings
          </h3>

          {alerts.length === 0 ? (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <CheckCircle size={32} style={{ color: 'var(--accent-neon)', margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem' }}>All warehouses reporting normal inventory levels.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alerts.map(n => (
                <div key={n.id} style={{ 
                  padding: '0.75rem 1rem', 
                  background: 'rgba(251, 191, 36, 0.04)', 
                  border: '1px solid rgba(251, 191, 36, 0.15)', 
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'start',
                  gap: '0.75rem'
                }}>
                  <div style={{ color: '#fbbf24', marginTop: '0.15rem' }}><AlertTriangle size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{n.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: '1.4' }}>{n.message}</div>
                  </div>
                  <button 
                    onClick={() => handleMarkRead(n.id)}
                    className="btn-icon-only"
                    style={{ width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                    title="Acknowledge Alert"
                  >
                    <Check size={14} style={{ color: 'var(--accent-neon)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
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

export const WarehouseView: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedWhId, setSelectedWhId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      const [w, p] = await Promise.all([
        fetchWarehouses(),
        fetchProducts()
      ]);
      setWarehouses(w);
      setProducts(p);
      if (w.length > 0) {
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem 0' }}>
        <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
      </div>
    );
  }

  const selectedWh = warehouses.find(w => w.id === selectedWhId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Left side: Warehouses Directory */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Landmark size={18} style={{ color: 'var(--accent-cyan)' }} />
          Storage Hub Facilities
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {warehouses.map(w => (
            <div 
              key={w.id} 
              onClick={() => setSelectedWhId(w.id)}
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: selectedWhId === w.id ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                border: selectedWhId === w.id ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid rgba(255,255,255,0.03)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📦</span>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: selectedWhId === w.id ? '#fff' : 'var(--text-secondary)' }}>{w.warehouse_name}</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Location: {w.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Selected Warehouse stock */}
      {selectedWh && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>{selectedWh.warehouse_name}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Logistics Hub Location: {selectedWh.location}</p>
            </div>
            <span style={{ fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', padding: '0.25rem 0.6rem', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '20px', fontWeight: 700 }}>
              ONLINE STATE
            </span>
          </div>

          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 700 }}>Stored Inventory Catalog</h4>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Product Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>SKU Code</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Stock Stored</th>
                </tr>
              </thead>
              <tbody>
                {/* Seeding products stock details */}
                {products.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '0.75rem', color: '#fff', fontWeight: 600 }}>{p.product_name}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.sku}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {p.stock_quantity} {p.unit || 'pcs'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};


// ─── 3. SUPPLIERS VIEW ──────────────────────────────────────

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Register Supplier states
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
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

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await createSupplier({
        supplier_name: name,
        contact_name: contact || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        gst_number: gstin || undefined
      });
      setSuccessMsg('Supplier successfully registered in active partner catalog!');
      setName('');
      setContact('');
      setEmail('');
      setPhone('');
      setAddress('');
      setGstin('');
      setShowAddForm(false);
      await loadSuppliers();
    } catch (e: any) {
      setErrorMsg(e.message || 'Supplier registration failed.');
    } finally {
      setFormLoading(false);
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

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="scan-action-btn btn-primary"
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          {showAddForm ? 'Close Form' : 'Register New Vendor'}
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

      {/* Add Supplier Form */}
      {showAddForm && (
        <form onSubmit={handleAddSupplier} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Landmark size={18} style={{ color: 'var(--accent-cyan)' }} />
            Register Business Vendor Profile
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
            {formLoading ? <Loader className="spin-anim" size={18} /> : 'Save Supplier Profile'}
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
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem' }}>Supplier Details</th>
                  <th style={{ padding: '1rem' }}>GSTIN Status</th>
                  <th style={{ padding: '1rem' }}>Contact Info</th>
                  <th style={{ padding: '1rem' }}>Office Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{s.supplier_name}</div>
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
                      <div style={{ color: '#fff' }}>{s.contact_name || 'N/A'}</div>
                      {s.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{s.email}</div>}
                      {s.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.phone}</div>}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.address}>
                      {s.address || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  
  // PO items builder
  const [poItems, setPoItems] = useState<Array<{ product_id: number; quantity: number; unit_price: number }>>([]);
  const [builderLoading, setBuilderLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

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
      await createPurchaseOrder({
        supplier_id: parseInt(selectedSupplierId),
        warehouse_id: selectedWhId ? parseInt(selectedWhId) : undefined,
        status: 'PENDING',
        delivery_date: deliveryDate || undefined,
        items: poItems
      });

      setSuccessMsg('Procurement Purchase Order compiled and saved in database as PENDING.');
      setPoItems([]);
      setDeliveryDate('');
      setShowBuilder(false);
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'PO compilation failed.');
    } finally {
      setBuilderLoading(false);
    }
  };

  // One-click Receive stock PO Completion
  const handleCompletePO = async (id: number, whId?: number) => {
    if (!whId) {
      setErrorMsg('Choose a destination warehouse facility before receiving inventory stock.');
      return;
    }
    setLoading(true);
    try {
      await updatePurchaseOrder(id, 'COMPLETED');
      setSuccessMsg('Stock registered and incremented in warehouse database successfully!');
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to complete PO.');
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    return poItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>Procurement & Purchase Invoices</h3>
        <button
          onClick={() => {
            setShowBuilder(!showBuilder);
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
        <form onSubmit={handleSubmitPO} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>Procured Items Catalog</label>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>
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
              <div key={po.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.015)' }}>
                {/* Header details */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.75rem', gap: '0.5rem' }}>
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

                    {/* Receive Stock Actions Button */}
                    {po.status === 'PENDING' && (
                      <button
                        onClick={() => handleCompletePO(po.id, po.warehouse_id)}
                        className="scan-action-btn btn-primary"
                        style={{ width: 'auto', padding: '0.25rem 0.65rem', fontSize: '0.7rem', height: '26px' }}
                      >
                        Receive Stock IN
                      </button>
                    )}
                  </div>
                </div>

                {/* Details layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Warehouse Hub</label>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{po.warehouse?.warehouse_name || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Supplier Entity</label>
                    <span style={{ fontWeight: 600, color: '#fff' }}>{po.supplier?.supplier_name || 'Seeded Partner'}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Expected Delivery</label>
                    <span>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : 'Immediate'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Invoice Valuation</label>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>₹{Number(po.total_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Items collapsed layout */}
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                  <label style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Manifest List</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(po.items || []).map((item, id) => (
                      <span key={id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
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

    </div>
  );
};


// ─── 5. SALES ORDERS VIEW ───────────────────────────────────

export const OrdersView: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrderResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Sales Creator states
  const [showBilling, setShowBilling] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  
  const [salesItems, setSalesItems] = useState<Array<{ product_id: number; quantity: number; price: number }>>([]);
  const [billingLoading, setBillingLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const loadData = async () => {
    try {
      const [ordData, prodData] = await Promise.all([
        fetchOrders(),
        fetchProducts()
      ]);
      setOrders(ordData);
      setProducts(prodData);
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
    setSalesItems([...salesItems, { product_id: products[0].id, quantity: 1, price: products[0].selling_price || 10 }]);
  };

  const handleRemoveItem = (index: number) => {
    setSalesItems(salesItems.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, prodId: number) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const copy = [...salesItems];
    copy[index] = {
      ...copy[index],
      product_id: prodId,
      price: prod.selling_price || 10
    };
    setSalesItems(copy);
  };

  const handleItemChange = (index: number, key: string, val: any) => {
    const copy = [...salesItems];
    copy[index] = { ...copy[index], [key]: val };
    setSalesItems(copy);
  };

  const handleSubmitSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salesItems.length === 0) {
      setErrorMsg('Add at least one product item to create invoice bill.');
      return;
    }

    setBillingLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await createOrder({
        customer_name: customerName,
        total_amount: calculateTotal(),
        status: 'COMPLETED',
        items: salesItems
      });

      setSuccessMsg('Sales Invoice generated successfully! Warehouse database decremented.');
      setSalesItems([]);
      setCustomerName('');
      setShowBilling(false);
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message || 'Billing failed. Check database stock quantities.');
    } finally {
      setBillingLoading(false);
    }
  };

  const calculateTotal = () => {
    return salesItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>Sales Billing & Client Invoices</h3>
        <button
          onClick={() => {
            setShowBilling(!showBilling);
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className="scan-action-btn btn-primary"
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          {showBilling ? 'Close Bill Center' : 'Generate Sales Invoice'}
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

      {/* Billing Invoice Creator */}
      {showBilling && (
        <form onSubmit={handleSubmitSales} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} style={{ color: 'var(--accent-neon)' }} />
            Sales POS Invoice Billing Center
          </h3>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Customer / Client Name *</label>
            <input
              type="text"
              required
              className="history-search-input"
              style={{ width: '100%' }}
              placeholder="e.g. John Doe International"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* Add product list items */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 700 }}>Invoice Sold Items</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="scan-action-btn btn-secondary"
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}
              >
                + Add Sold Product
              </button>
            </div>

            {salesItems.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>No products listed.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {salesItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    
                    {/* Choose Product */}
                    <select
                      className="camera-select"
                      style={{ padding: '0.55rem 0.65rem', fontSize: '0.8rem' }}
                      value={item.product_id}
                      onChange={(e) => handleProductSelect(idx, parseInt(e.target.value))}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.product_name} (₹{p.selling_price || 0})</option>
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

                    {/* Price */}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Selling Cost"
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-neon)' }}>
            Invoice Net Total: ₹{calculateTotal().toFixed(2)}
          </div>

          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', height: '44px' }}
            disabled={billingLoading}
          >
            {billingLoading ? <Loader className="spin-anim" size={18} /> : 'Post Customer Invoice & Commit Stock Deduction'}
          </button>
        </form>
      )}

      {/* Orders List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <Loader className="spin-anim" size={24} style={{ color: 'var(--accent-cyan)' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Landmark size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
              <h4>No Sales Orders Found</h4>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(255,255,255,0.015)' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Client: {order.customer_name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>ID: Invoice-{order.id}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                    {order.status}
                  </span>
                </div>

                {/* Billing Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Invoice compiled on: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-neon)' }}>₹{Number(order.total_amount || 0).toFixed(2)}</span>
                </div>

                {/* manifest list */}
                {order.items && order.items.length > 0 && (
                  <div style={{ background: 'rgba(0,0,0,0.1)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(order.items || []).map((item, id) => (
                        <span key={id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.15rem 0.45rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
                          Product ID: {item.product_id} (x{item.quantity}) — ₹{Number(item.price || 0).toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
