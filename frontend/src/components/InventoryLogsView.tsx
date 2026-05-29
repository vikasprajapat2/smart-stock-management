import React, { useState, useEffect } from 'react';
import { 
  Clock, Search, RefreshCw, AlertTriangle, 
  ArrowRight, ShieldAlert
} from 'lucide-react';
import { 
  fetchInventoryLogs, fetchProducts, fetchWarehouses, checkBackendConnection 
} from '../utils/api';
import type { 
  InventoryLog, Product, Warehouse 
} from '../utils/api';

export const InventoryLogsView: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      if (!connected) throw new Error('Backend server is offline.');

      const [logsData, prodsData, whsData] = await Promise.all([
        fetchInventoryLogs(),
        fetchProducts(),
        fetchWarehouses()
      ]);
      
      // Sort logs by newest first
      setLogs(logsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setProducts(prodsData);
      setWarehouses(whsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load stock transaction logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProductInfo = (productId: number) => {
    const p = products.find(prod => prod.id === productId);
    return p ? { name: p.product_name, sku: p.sku, unit: p.unit || 'pcs' } : { name: `Product ID: ${productId}`, sku: 'N/A', unit: 'pcs' };
  };

  const getWarehouseName = (warehouseId?: number) => {
    if (!warehouseId) return 'N/A';
    const w = warehouses.find(wh => wh.id === warehouseId);
    return w ? w.warehouse_name : `Warehouse ID: ${warehouseId}`;
  };

  const getActionStyles = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('IN')) {
      return {
        background: 'rgba(34, 197, 94, 0.12)',
        color: 'var(--accent-neon)',
        border: '1px solid rgba(34, 197, 94, 0.25)',
        text: 'STOCK IN'
      };
    } else if (act.includes('OUT')) {
      return {
        background: 'rgba(244, 63, 94, 0.12)',
        color: '#fb7185',
        border: '1px solid rgba(244, 63, 94, 0.25)',
        text: 'STOCK OUT'
      };
    } else if (act.includes('RECEIPT')) {
      return {
        background: 'rgba(59, 130, 246, 0.12)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        text: 'PO RECEIPT'
      };
    } else if (act.includes('UPDATE')) {
      return {
        background: 'rgba(167, 139, 250, 0.12)',
        color: '#c084fc',
        border: '1px solid rgba(167, 139, 250, 0.25)',
        text: 'STOCK EDIT'
      };
    } else {
      return {
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'var(--text-secondary)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        text: act
      };
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const pInfo = getProductInfo(log.product_id);
    const whName = getWarehouseName(log.warehouse_id);
    const s = searchTerm.toLowerCase();
    
    // Keyword search match
    const matchesKeyword = (
      pInfo.name.toLowerCase().includes(s) ||
      pInfo.sku.toLowerCase().includes(s) ||
      whName.toLowerCase().includes(s) ||
      log.action.toLowerCase().includes(s) ||
      log.id.toString().includes(s)
    );

    // Dropdown action match
    const act = log.action.toUpperCase();
    let matchesAction = true;
    if (filterAction !== 'ALL') {
      if (filterAction === 'IN') matchesAction = act.includes('IN') || act.includes('RECEIPT');
      else if (filterAction === 'OUT') matchesAction = act.includes('OUT');
      else if (filterAction === 'UPDATE') matchesAction = act.includes('UPDATE');
    }

    return matchesKeyword && matchesAction;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Connection notification */}
      {!isConnected && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <ShieldAlert size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.15rem' }}>Audit DB Connection Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Activity logs cannot sync with backend databases.</p>
          </div>
        </div>
      )}

      {/* Control bar filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search logs by product, SKU, facility, or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Action filter */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="camera-select"
            style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', width: '160px' }}
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="ALL">All Operations</option>
            <option value="IN">Stock Inwards</option>
            <option value="OUT">Stock Outwards</option>
            <option value="UPDATE">Direct Corrections</option>
          </select>

          <button onClick={() => loadData(false)} className="scan-action-btn btn-secondary" style={{ padding: '0.8rem', width: 'auto' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
        </div>
      </div>

      {error && !loading && (
        <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* Transaction timeline table */}
      {!loading && isConnected && (
        <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>No Audit Logs Found</h4>
              <p style={{ fontSize: '0.85rem' }}>Perform scans or stock adjustments to populate records.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem' }}>Timestamp</th>
                  <th style={{ padding: '1rem' }}>Activity Type</th>
                  <th style={{ padding: '1rem' }}>Product Details</th>
                  <th style={{ padding: '1rem' }}>Warehouse Facility</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Adjustment Flow</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Quantity Delta</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const pInfo = getProductInfo(log.product_id);
                  const actStyle = getActionStyles(log.action);
                  
                  // Calculate change direction
                  const diff = log.new_quantity - log.old_quantity;
                  const isPositive = diff >= 0;

                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {/* Timestamp */}
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>

                      {/* Action Badge */}
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          background: actStyle.background,
                          color: actStyle.color,
                          border: actStyle.border,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {actStyle.text}
                        </span>
                      </td>

                      {/* Product details */}
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{pInfo.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{pInfo.sku}</div>
                      </td>

                      {/* Warehouse Facility */}
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                        {getWarehouseName(log.warehouse_id)}
                      </td>

                      {/* Stock Adjustment Flow */}
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{log.old_quantity}</span>
                          <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                          <span style={{ fontWeight: 700, color: '#fff' }}>{log.new_quantity}</span>
                        </div>
                      </td>

                      {/* Delta */}
                      <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 800, color: isPositive ? 'var(--accent-neon)' : '#ef4444' }}>
                        {isPositive ? '+' : ''}{diff} {pInfo.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Loading fallback overlay */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
          <RefreshCw className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Synching inventory audit history...</span>
        </div>
      )}

    </div>
  );
};
