import React, { useState, useEffect } from 'react';
import { 
  Bell, ShoppingBag, Loader, AlertTriangle, Check, RefreshCw, 
  Search, ArrowRight, Lock, CheckCircle, XCircle
} from 'lucide-react';
import { 
  fetchPurchaseRequests, compilePOFromPR, fetchSuppliers, 
  fetchWarehouses, checkBackendConnection 
} from '../utils/api';
import type { 
  PurchaseRequestResponse, Supplier, Warehouse, PurchaseOrderResponse 
} from '../utils/api';

export const PurchaseRequestsManager: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [requests, setRequests] = useState<PurchaseRequestResponse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PO_CREATED' | 'CANCELLED'>('ALL');

  // Compile PO Modal
  const [showCompileModal, setShowCompileModal] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequestResponse | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [compileLoading, setCompileLoading] = useState<boolean>(false);
  const [compiledPO, setCompiledPO] = useState<PurchaseOrderResponse | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      if (!connected) throw new Error('Backend server is offline.');

      const [prData, supData, whData] = await Promise.all([
        fetchPurchaseRequests(),
        fetchSuppliers(),
        fetchWarehouses()
      ]);
      setRequests(prData);
      setSuppliers(supData.filter(s => s.is_active));
      setWarehouses(whData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load procurement request logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCompileModal = (req: PurchaseRequestResponse) => {
    setSelectedRequest(req);
    setCompiledPO(null);
    setSelectedSupplierId('');
    setSelectedWarehouseId(warehouses.length > 0 ? warehouses[0].id.toString() : '');
    setShowCompileModal(true);
    setSuccess('');
    setError('');
  };

  const handleCompilePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedSupplierId) {
      setError('Please select an active Supplier to fulfill this Purchase Order.');
      return;
    }

    setCompileLoading(true);
    setError('');
    setSuccess('');
    try {
      const po = await compilePOFromPR(
        selectedRequest.id,
        parseInt(selectedSupplierId),
        selectedWarehouseId ? parseInt(selectedWarehouseId) : undefined
      );
      setCompiledPO(po);
      setSuccess(`Fulfillment complete! Purchase Order ${po.po_number} successfully compiled and drafted in PENDING state.`);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to compile purchase order from raw request.');
    } finally {
      setCompileLoading(false);
    }
  };

  // Find supplier details when selected in dropdown
  const activeSupplierDetails = suppliers.find(s => s.id === parseInt(selectedSupplierId));

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.product?.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.product?.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Network offline panel */}
      {!isConnected && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <AlertTriangle size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h4 style={{ fontWeight: 700 }}>Procurement Scheduler Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Purchase request planner cannot communicate with core inventory networks.</p>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', flex: '1 1 400px' }}>
          
          {/* Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="history-search-input"
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              placeholder="Search by missing product or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status filter buttons */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '2px' }}>
            {(['ALL', 'PENDING', 'PO_CREATED', 'CANCELLED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.85rem',
                  background: statusFilter === f ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  color: statusFilter === f ? 'var(--accent-purple)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {f === 'ALL' ? 'All Alerts' : f === 'PENDING' ? 'Pending Warnings' : f === 'PO_CREATED' ? 'PO Compiled' : 'Cancelled'}
              </button>
            ))}
          </div>

        </div>

        <button onClick={() => loadData(false)} className="scan-action-btn btn-secondary" style={{ padding: '0.8rem', width: 'auto' }} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
        </button>
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

      {/* Main Request Alerts manifest table */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
        {loading && requests.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
            <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Calculating warehouse stock reorder alerts...</span>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Bell size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>No Purchase Requests Pending</h4>
            <p style={{ fontSize: '0.85rem' }}>Automated reorder alerts populate when product inventory drops below safety limits.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '1rem' }}>ID & Alert Date</th>
                <th style={{ padding: '1rem' }}>Component / Raw Material</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Safety Level</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Current Stock</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Deficit / Order Qty</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status Alert</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Fulfillment Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const isPending = req.status === 'PENDING';
                const isOrdered = req.status === 'PO_CREATED';

                return (
                  <tr key={req.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>#PR-{req.id}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{new Date(req.created_at).toLocaleDateString()}</div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.product?.product_name || `Product ID: ${req.product_id}`}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{req.product?.sku}</div>
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      {req.product?.reorder_level || 'N/A'} {req.product?.unit || 'pcs'}
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center', color: '#f87171', fontWeight: 600 }}>
                      {req.product?.stock_quantity ?? 0} {req.product?.unit || 'pcs'}
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                      {req.quantity_required} {req.product?.unit || 'pcs'}
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: isPending ? 'rgba(239, 68, 68, 0.1)' : isOrdered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(0,0,0,0.05)',
                        color: isPending ? '#f87171' : isOrdered ? 'var(--accent-neon)' : 'var(--text-muted)',
                        border: isPending ? '1px solid rgba(239, 68, 68, 0.2)' : isOrdered ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(0,0,0,0.1)'
                      }}>
                        {req.status === 'PENDING' ? 'Low Stock Alert' : req.status === 'PO_CREATED' ? 'PO Compiled' : req.status}
                      </span>
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {isPending ? (
                        <button
                          onClick={() => handleOpenCompileModal(req)}
                          className="scan-action-btn btn-secondary"
                          style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                        >
                          <ShoppingBag size={12} style={{ marginRight: '0.25rem' }} /> Fulfill & Create PO
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <Lock size={12} /> Compiled PO
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PO Compilation Wizard Modal */}
      {showCompileModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '550px',
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingBag size={18} style={{ color: 'var(--accent-purple)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Fulfill Procurement Reorder Alert</h3>
              </div>
              <button 
                onClick={() => { setShowCompileModal(false); setSelectedRequest(null); setCompiledPO(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            {success && compiledPO ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1rem 0', alignItems: 'center', textAlign: 'center' }}>
                <CheckCircle size={48} style={{ color: 'var(--accent-neon)' }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Fulfillment Purchase Invoice Compiled!</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Purchase Order <strong>{compiledPO.po_number}</strong> was created successfully.
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Destination Facility: {warehouses.find(w => w.id === compiledPO.warehouse_id)?.warehouse_name}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => { setShowCompileModal(false); setSelectedRequest(null); setCompiledPO(null); }}
                    className="scan-action-btn btn-secondary" 
                    style={{ flex: 1 }}
                  >
                    Close Wizard
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCompilePO} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Product Summary */}
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', border: '1px solid rgba(0,0,0,0.04)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Item Needing Reorder</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.25rem' }}>{selectedRequest.product?.product_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>SKU: {selectedRequest.product?.sku}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px dashed rgba(0,0,0,0.06)', paddingTop: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Warehouse Stock: </span>
                      <strong style={{ color: '#f87171' }}>{selectedRequest.product?.stock_quantity ?? 0} {selectedRequest.product?.unit}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Required replenishment: </span>
                      <strong style={{ color: 'var(--accent-cyan)' }}>{selectedRequest.quantity_required} {selectedRequest.product?.unit}</strong>
                    </div>
                  </div>
                </div>

                {/* Select Supplier */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Fulfillment Supplier *</label>
                  <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                    <option value="">Choose Supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name} {s.contact_name ? `(${s.contact_name})` : ''}</option>)}
                  </select>
                  {suppliers.length === 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: '0.25rem', display: 'block' }}>⚠️ No active suppliers found. Please register suppliers under the Suppliers tab first.</span>
                  )}
                </div>

                {/* Supplier contact Details popup inside modal */}
                {activeSupplierDetails && (
                  <div style={{ 
                    background: 'rgba(139, 92, 246, 0.04)', 
                    border: '1px solid rgba(139, 92, 246, 0.15)',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    fontSize: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>Selected Supplier Info:</div>
                    {activeSupplierDetails.email && <div>✉️ Email: {activeSupplierDetails.email}</div>}
                    {activeSupplierDetails.phone && <div>📞 Phone: {activeSupplierDetails.phone}</div>}
                    {activeSupplierDetails.gst_number && <div>🧾 GSTIN: {activeSupplierDetails.gst_number}</div>}
                  </div>
                )}

                {/* Select Warehouse Destination */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Destination Warehouse Facility</label>
                  <select className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={selectedWarehouseId} onChange={(e) => setSelectedWarehouseId(e.target.value)}>
                    <option value="">Auto-Assign default</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.warehouse_name} ({w.location})</option>)}
                  </select>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Choose which storage warehouse should receive these components.</span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => { setShowCompileModal(false); setSelectedRequest(null); }}
                    className="scan-action-btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>

                  <button 
                    type="submit" 
                    className="scan-action-btn btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    disabled={compileLoading || !selectedSupplierId}
                  >
                    {compileLoading ? <Loader className="spin-anim" size={16} /> : (
                      <>
                        <span>Compile & Order</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
