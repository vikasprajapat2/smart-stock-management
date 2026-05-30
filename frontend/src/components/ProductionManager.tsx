import React, { useState, useEffect } from 'react';
import { 
  Factory, Plus, Search, Loader, AlertTriangle, Check, RefreshCw, 
  Play, CheckCircle2, Lock, XCircle, Eye
} from 'lucide-react';
import { 
  fetchProductionOrders, createProductionOrder, checkProductionStock, 
  approveProductionOrder, startProductionOrder, completeProductionOrder, 
  fetchProducts, fetchBOMs, checkBackendConnection 
} from '../utils/api';
import type { 
  ProductionOrderResponse, ProductionOrderCreateInput, StockAvailabilityResponse, Product, BOMResponse 
} from '../utils/api';

export const ProductionManager: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [orders, setOrders] = useState<ProductionOrderResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BOMResponse[]>([]);

  // Search & Form Visibility
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);

  // New order form states
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [bomId, setBomId] = useState<string>('');
  const [quantityToProduce, setQuantityToProduce] = useState<string>('1');

  // MRP Checker Modal state
  const [showAvailabilityModal, setShowAvailabilityModal] = useState<boolean>(false);
  const [availabilityOrder, setAvailabilityOrder] = useState<ProductionOrderResponse | null>(null);
  const [availabilityData, setAvailabilityData] = useState<StockAvailabilityResponse | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState<boolean>(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      if (!connected) throw new Error('Backend server is offline.');

      const [ordersData, prodsData, bomsData] = await Promise.all([
        fetchProductionOrders(),
        fetchProducts(),
        fetchBOMs()
      ]);
      setOrders(ordersData);
      setProducts(prodsData);
      setBoms(bomsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load production order records.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-generate order number when form opens
  useEffect(() => {
    if (showAddForm && !orderNumber) {
      const pin = Math.floor(1000 + Math.random() * 9000);
      setOrderNumber(`WO-${Date.now().toString().slice(-6)}-${pin}`);
    }
  }, [showAddForm]);

  // When product changes, auto-select first approved BOM for that product if available
  useEffect(() => {
    if (productId) {
      const filtered = boms.filter(b => b.product_id === parseInt(productId) && b.status === 'APPROVED');
      if (filtered.length > 0) {
        setBomId(filtered[0].id.toString());
      } else {
        setBomId('');
      }
    } else {
      setBomId('');
    }
  }, [productId, boms]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!orderNumber.trim() || !productId || !bomId || parseFloat(quantityToProduce) <= 0) {
      setError('Please provide a valid Work Order number, Finished Good, Approved BOM recipe, and target quantity.');
      return;
    }

    setFormLoading(true);
    try {
      const payload: ProductionOrderCreateInput = {
        production_order_number: orderNumber.trim(),
        product_id: parseInt(productId),
        bom_id: parseInt(bomId),
        quantity_to_produce: parseFloat(quantityToProduce)
      };

      await createProductionOrder(payload);
      setSuccess(`Work Order ${payload.production_order_number} created successfully in DRAFT mode.`);
      
      // Reset form
      setOrderNumber('');
      setProductId('');
      setBomId('');
      setQuantityToProduce('1');
      setShowAddForm(false);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to create Production Order.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleCheckAvailability = async (order: ProductionOrderResponse) => {
    setAvailabilityOrder(order);
    setShowAvailabilityModal(true);
    setAvailabilityLoading(true);
    setAvailabilityData(null);
    setError('');
    
    try {
      const data = await checkProductionStock(order.id);
      setAvailabilityData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze material availability.');
      setShowAvailabilityModal(false);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleApproveOrder = async (order: ProductionOrderResponse) => {
    if (!confirm(`Are you sure you want to approve Work Order ${order.production_order_number}? This will automatically lock and RESERVE raw component stock in your warehouse.`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await approveProductionOrder(order.id);
      setSuccess(`Work Order ${res.production_order_number} approved! Raw material stock reserved successfully.`);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Approval failed. Verify inventory balances or make purchase requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async (order: ProductionOrderResponse) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await startProductionOrder(order.id);
      setSuccess(`Work Order ${res.production_order_number} is now IN PRODUCTION! Shop floor run started.`);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to start shop floor run.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (order: ProductionOrderResponse) => {
    if (!confirm(`Complete production for Work Order ${order.production_order_number}? Finished goods will be added to stock, and reserved raw materials will be fully consumed.`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await completeProductionOrder(order.id);
      setSuccess(`Success! Work Order ${res.production_order_number} Completed. Raw stock deducted, finished inventory boosted.`);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to finalize production order.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    const q = searchTerm.toLowerCase();
    const prodName = products.find(p => p.id === o.product_id)?.product_name || '';
    return (
      o.production_order_number.toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      prodName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Off-line warning panel */}
      {!isConnected && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <AlertTriangle size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h4 style={{ fontWeight: 700 }}>MRP Scheduler Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Production manager cannot connect to PostgreSQL warehouse service.</p>
          </div>
        </div>
      )}

      {/* Control bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search work orders by number, status, or target good..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => loadData(false)} className="scan-action-btn btn-secondary" style={{ padding: '0.8rem', width: 'auto' }} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          
          <button
            onClick={() => {
              const toggled = !showAddForm;
              setShowAddForm(toggled);
              setSuccess('');
              if (!toggled) {
                setOrderNumber('');
                setProductId('');
                setBomId('');
                setQuantityToProduce('1');
              }
            }}
            className="scan-action-btn btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={!isConnected}
          >
            <Plus size={16} />
            <span>{showAddForm ? 'Close Planner' : 'Plan Work Order'}</span>
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

      {/* Creation Form Wizard */}
      {showAddForm && (
        <form onSubmit={handleCreateOrder} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Factory size={18} style={{ color: 'var(--accent-cyan)' }} />
            Plan New Manufacturing Work Order
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Work Order Number *</label>
              <input type="text" required className="history-search-input" style={{ width: '100%' }} placeholder="Auto-generated (e.g. WO-2026-001)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Finished Good to Produce *</label>
              <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select Product...</option>
                {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Select Approved BOM Recipe *</label>
              <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={bomId} onChange={(e) => setBomId(e.target.value)} disabled={!productId}>
                <option value="">Choose Recipe...</option>
                {boms.filter(b => b.product_id === parseInt(productId) && b.status === 'APPROVED').map(b => (
                  <option key={b.id} value={b.id}>{b.bom_number} (v{b.version}) - Cost: ₹{b.total_cost.toFixed(2)}</option>
                ))}
              </select>
              {!productId && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>Please select finished good first.</span>}
              {productId && boms.filter(b => b.product_id === parseInt(productId) && b.status === 'APPROVED').length === 0 && (
                <span style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: '0.25rem', display: 'block' }}>⚠️ No APPROVED BOM recipes found. Create and Approve one in the BOM Recipes tab!</span>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Target Quantity to Produce *</label>
              <input type="number" min="0.01" step="any" required className="history-search-input" style={{ width: '100%' }} value={quantityToProduce} onChange={(e) => setQuantityToProduce(e.target.value)} />
            </div>
          </div>

          <button type="submit" className="scan-action-btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', height: '44px' }} disabled={formLoading || (!!productId && boms.filter(b => b.product_id === parseInt(productId) && b.status === 'APPROVED').length === 0)}>
            {formLoading ? <Loader className="spin-anim" size={18} /> : 'Compile & Save Work Order'}
          </button>
        </form>
      )}

      {/* Orders Manifest Table */}
      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
        {loading && orders.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
            <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Analyzing manufacturing database...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Factory size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
            <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>No Work Orders Active</h4>
            <p style={{ fontSize: '0.85rem' }}>Create manufacturing orders to trigger raw materials routing.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                <th style={{ padding: '1rem' }}>Work Order</th>
                <th style={{ padding: '1rem' }}>Target Item</th>
                <th style={{ padding: '1rem' }}>BOM Recipe</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Target Qty</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Status Badge</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Operations / MRP Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const targetProd = products.find(p => p.id === order.product_id);
                const activeBom = boms.find(b => b.id === order.bom_id);
                const status = order.status;

                // Status theme
                let badgeStyle = { background: 'rgba(0,0,0,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(0,0,0,0.1)' };
                if (status === 'DRAFT') {
                  badgeStyle = { background: 'rgba(245, 158, 11, 0.08)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' };
                } else if (status === 'APPROVED') {
                  badgeStyle = { background: 'rgba(59, 130, 246, 0.12)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.2)' };
                } else if (status === 'IN_PRODUCTION') {
                  badgeStyle = { background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' };
                } else if (status === 'COMPLETED') {
                  badgeStyle = { background: 'rgba(34, 197, 94, 0.12)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.2)' };
                } else if (status === 'CANCELLED') {
                  badgeStyle = { background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' };
                }

                return (
                  <tr key={order.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{order.production_order_number}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Planned: {new Date(order.created_at).toLocaleDateString()}</div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{targetProd ? targetProd.product_name : `Product ID: ${order.product_id}`}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{targetProd?.sku}</div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeBom ? activeBom.bom_number : `BOM ID: ${order.bom_id}`}</span>
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {order.quantity_to_produce} {targetProd?.unit || 'pcs'}
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        ...badgeStyle
                      }}>
                        {status}
                      </span>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        
                        {status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleCheckAvailability(order)}
                              className="scan-action-btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.2)' }}
                              title="MRP Check Stocks"
                            >
                              <Eye size={12} style={{ marginRight: '0.25rem' }} /> Stock Check
                            </button>
                            <button
                              onClick={() => handleApproveOrder(order)}
                              className="scan-action-btn btn-secondary"
                              style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                              title="Approve & Reserve Stocks"
                            >
                              <Lock size={12} style={{ marginRight: '0.25rem' }} /> Approve & Reserve
                            </button>
                          </>
                        )}

                        {status === 'APPROVED' && (
                          <button
                            onClick={() => handleStartOrder(order)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                            title="Start Shop Floor Run"
                          >
                            <Play size={12} style={{ marginRight: '0.25rem' }} /> Run Shop Floor
                          </button>
                        )}

                        {status === 'IN_PRODUCTION' && (
                          <button
                            onClick={() => handleCompleteOrder(order)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
                            title="Complete & Deduct Stocks"
                          >
                            <CheckCircle2 size={12} style={{ marginRight: '0.25rem' }} /> Complete Run
                          </button>
                        )}

                        {(status === 'COMPLETED' || status === 'CANCELLED') && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Lock size={12} /> Locked Record
                          </span>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MRP Stock Availability Checker Modal */}
      {showAvailabilityModal && (
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
            maxWidth: '650px',
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
                <Eye size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>MRP Material Stock Checker</h3>
              </div>
              <button 
                onClick={() => { setShowAvailabilityModal(false); setAvailabilityData(null); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            {availabilityLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
                <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Calculating warehouse stock levels...</span>
              </div>
            ) : availabilityData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* Summary header */}
                <div style={{ 
                  background: availabilityData.is_fully_available ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)', 
                  border: availabilityData.is_fully_available ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '1rem',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  {availabilityData.is_fully_available ? (
                    <CheckCircle2 size={24} style={{ color: 'var(--accent-neon)' }} />
                  ) : (
                    <AlertTriangle size={24} style={{ color: '#ef4444' }} />
                  )}
                  <div>
                    <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {availabilityData.is_fully_available ? 'All Materials In Stock!' : 'Raw Materials Shortage Detected'}
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      {availabilityData.is_fully_available 
                        ? 'You have enough component stock to complete this work order. Approve order to reserve stock.' 
                        : 'Some ingredients are missing from warehouses. Check missing lists below and place Purchase Requests.'}
                    </p>
                  </div>
                </div>

                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>Raw Components Breakdown</div>
                
                {/* Manifest list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {availabilityData.items.map(item => {
                    const pct = Math.min(100, (item.quantity_available / item.quantity_required) * 100);
                    const isOk = item.is_available;

                    return (
                      <div key={item.material_product_id} style={{ 
                        background: 'rgba(0,0,0,0.01)', 
                        border: '1px solid rgba(0,0,0,0.04)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.material_name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: '0.5rem' }}>({item.sku})</span>
                          </div>
                          
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: isOk ? 'var(--accent-neon)' : '#ef4444',
                            fontWeight: 700,
                            background: isOk ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px'
                          }}>
                            {isOk ? 'AVAILABLE' : `SHORTAGE: ${item.quantity_shortage.toFixed(1)}`}
                          </span>
                        </div>

                        {/* Progress Bar visual stock ratio */}
                        <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: isOk ? 'linear-gradient(90deg, #22c55e, #10b981)' : 'linear-gradient(90deg, #ef4444, #f59e0b)',
                            borderRadius: '3px',
                            transition: 'width 0.4s ease'
                          }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>In Stock: {item.quantity_available.toFixed(1)}</span>
                          <span>Required: {item.quantity_required.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Direct Action triggers */}
                <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => { setShowAvailabilityModal(false); setAvailabilityData(null); }}
                    className="scan-action-btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Close Dialog
                  </button>

                  {availabilityData.is_fully_available ? (
                    <button 
                      onClick={() => {
                        setShowAvailabilityModal(false);
                        if (availabilityOrder) handleApproveOrder(availabilityOrder);
                      }}
                      className="scan-action-btn btn-primary"
                      style={{ flex: 1 }}
                    >
                      <Lock size={14} style={{ marginRight: '0.25rem' }} /> Approve & Reserve Now
                    </button>
                  ) : (
                    <div style={{ flex: 1, color: '#f87171', fontSize: '0.75rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      ⚠️ Please check the "Automated Purchase Requests" panel to order shortages.
                    </div>
                  )}
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}

    </div>
  );
};
