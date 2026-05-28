import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Loader, AlertTriangle, Check, RefreshCw, Trash2, Edit2, ShieldAlert } from 'lucide-react';
import { fetchInventoryRecords, createInventoryRecord, updateInventoryRecord, deleteInventoryRecord, fetchProducts, fetchWarehouses, checkBackendConnection } from '../utils/api';
import type { Product, Warehouse, Inventory } from '../utils/api';

export const InventoryRecordsView: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form states
  const [productId, setProductId] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('0');
  const [quantityReserved, setQuantityReserved] = useState<string>('0');

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      if (!connected) throw new Error('Backend offline');

      const [invData, prodData, whData] = await Promise.all([
        fetchInventoryRecords(),
        fetchProducts(),
        fetchWarehouses()
      ]);
      setInventory(invData);
      setProducts(prodData);
      setWarehouses(whData);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load inventory records.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !warehouseId) return;
    setFormLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const payload = {
        product_id: parseInt(productId),
        warehouse_id: parseInt(warehouseId),
        quantity_available: parseInt(quantity) || 0,
        quantity_reserved: parseInt(quantityReserved) || 0
      };

      if (editingId) {
        await updateInventoryRecord(editingId, payload);
        setSuccess('Inventory record updated successfully.');
      } else {
        await createInventoryRecord(payload);
        setSuccess('Inventory record created successfully.');
      }
      
      setProductId('');
      setWarehouseId('');
      setQuantity('0');
      setQuantityReserved('0');
      setShowAddForm(false);
      setEditingId(null);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to save inventory record.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (inv: Inventory) => {
    setEditingId(inv.id);
    setProductId(inv.product_id.toString());
    setWarehouseId(inv.warehouse_id.toString());
    setQuantity(inv.quantity.toString());
    setQuantityReserved(inv.quantity_reserved.toString());
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this inventory record?')) return;
    try {
      await deleteInventoryRecord(id);
      setSuccess('Inventory record deleted successfully.');
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete inventory record.');
    }
  };

  const filteredInventory = inventory.filter(inv => {
    const p = products.find(prod => prod.id === inv.product_id);
    const w = warehouses.find(wh => wh.id === inv.warehouse_id);
    const s = searchTerm.toLowerCase();
    return (
      (p?.product_name || '').toLowerCase().includes(s) ||
      (w?.warehouse_name || '').toLowerCase().includes(s) ||
      inv.id.toString().includes(s)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {!isConnected && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <ShieldAlert size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.15rem' }}>Backend Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Cannot reach the database.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search by product name, warehouse, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => loadData(false)} className="scan-action-btn btn-secondary" style={{ padding: '0.8rem' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          <button
            onClick={() => {
              const toggled = !showAddForm;
              setShowAddForm(toggled);
              setSuccess('');
              if (!toggled) {
                setEditingId(null);
                setProductId('');
                setWarehouseId('');
                setQuantity('0');
                setQuantityReserved('0');
              }
            }}
            className="scan-action-btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={!isConnected}
          >
            <Plus size={16} />
            <span className="hide-mobile">{showAddForm ? 'Close Form' : 'Add Record'}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', color: 'var(--accent-neon)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={18} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{success}</span>
        </div>
      )}
      
      {error && !loading && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSave} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} style={{ color: 'var(--accent-cyan)' }} />
            {editingId ? 'Edit Inventory Record' : 'Add Inventory Record'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Product *</label>
              <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select Product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.product_name} (SKU: {p.sku})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Warehouse *</label>
              <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Select Warehouse...</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Quantity Available</label>
              <input type="number" required className="history-search-input" style={{ width: '100%' }} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Quantity Reserved</label>
              <input type="number" required className="history-search-input" style={{ width: '100%' }} value={quantityReserved} onChange={(e) => setQuantityReserved(e.target.value)} />
            </div>
          </div>

          <button type="submit" className="scan-action-btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', height: '44px' }} disabled={formLoading}>
            {formLoading ? <Loader className="spin-anim" size={18} /> : (editingId ? 'Update Record' : 'Save Record')}
          </button>
        </form>
      )}

      {!loading && isConnected && (
        <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
          {filteredInventory.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Database size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>No Records Found</h4>
              <p style={{ fontSize: '0.85rem' }}>Create a record to get started.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem' }}>ID</th>
                  <th style={{ padding: '1rem' }}>Product</th>
                  <th style={{ padding: '1rem' }}>Warehouse</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Available</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Reserved</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(inv => {
                  const p = products.find(prod => prod.id === inv.product_id);
                  const w = warehouses.find(wh => wh.id === inv.warehouse_id);
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>#{inv.id}</td>
                      <td style={{ padding: '1rem', fontWeight: 600, color: '#fff' }}>{p ? p.product_name : `Product ID: ${inv.product_id}`}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{w ? w.warehouse_name : `Warehouse ID: ${inv.warehouse_id}`}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#22c55e' }}>{inv.quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#f59e0b' }}>{inv.quantity_reserved}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button onClick={() => handleEdit(inv)} className="scan-action-btn btn-secondary" style={{ padding: '0.45rem', width: 'auto' }} title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(inv.id)} className="scan-action-btn btn-secondary" style={{ padding: '0.45rem', width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
