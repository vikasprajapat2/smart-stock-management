import React, { useState, useEffect } from 'react';
import { 
  fetchSalesOrders, createSalesOrder, approveSalesOrder, deleteSalesOrder, 
  type SalesOrderResponse, type SalesOrderCreateInput, type SalesOrderItemCreate,
  fetchCustomers, type Customer,
  fetchProducts, type Product
} from '../utils/api';
import { ShoppingCart, Plus, Trash2, CheckCircle, Package, Calendar, AlertCircle, FileText, X } from 'lucide-react';

const SalesOrderManager: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrderResponse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<SalesOrderCreateInput>({
    sales_order_number: '',
    customer_id: 0,
    total_amount: 0,
    items: []
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordData, custData, prodData] = await Promise.all([
        fetchSalesOrders(),
        fetchCustomers(),
        fetchProducts()
      ]);
      setOrders(ordData);
      setCustomers(custData);
      setProducts(prodData);
      if (custData.length > 0) setFormData(f => ({...f, customer_id: custData[0].id}));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = () => {
    if (products.length === 0) return;
    setFormData(f => ({
      ...f, 
      items: [...f.items, { product_id: products[0].id, quantity: 1, rate: products[0].selling_price || 0, total: products[0].selling_price || 0 }]
    }));
  };

  const handleItemChange = (index: number, field: keyof SalesOrderItemCreate, value: number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      newItems[index].total = newItems[index].quantity * newItems[index].rate;
    }
    
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, total_amount: newTotal });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    const newTotal = newItems.reduce((sum, item) => sum + item.total, 0);
    setFormData({ ...formData, items: newItems, total_amount: newTotal });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.sales_order_number || formData.items.length === 0) {
        throw new Error("Order number and at least one item are required.");
      }
      await createSalesOrder(formData);
      setShowForm(false);
      setFormData({ sales_order_number: '', customer_id: customers[0]?.id || 0, total_amount: 0, items: [] });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveSalesOrder(id);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this sales order?")) return;
    try {
      await deleteSalesOrder(id);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'APPROVED': return { bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', dot: '#16a34a' };
      case 'DRAFT': return { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706', dot: '#d97706' };
      default: return { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', dot: '#2563eb' };
    }
  };

  return (
    <div className="erp-card glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
              <ShoppingCart size={24} style={{ color: '#3b82f6' }} />
            </div>
            Sales Orders
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage customer orders, approve production, and track order fulfillment.
          </p>
        </div>
        
        <button 
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: showForm ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-neon)',
            color: showForm ? '#ef4444' : '#fff',
            border: showForm ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: showForm ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
        >
          {showForm ? 'Cancel Creation' : <><Plus size={18} /> New Sales Order</>}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div style={{ background: 'rgba(255, 255, 255, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} /> Order Details
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Order Number *</label>
                <input required placeholder="e.g. SO-2023-001" style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }} value={formData.sales_order_number} onChange={e => setFormData({...formData, sales_order_number: e.target.value})} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer *</label>
                <select 
                  style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }}
                  value={formData.customer_id}
                  onChange={e => setFormData({...formData, customer_id: Number(e.target.value)})}
                >
                  {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                </select>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Line Items</h4>
                <button type="button" onClick={handleAddItem} style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
              
              <div style={{ background: '#fff', border: '1px solid var(--border-glass)', borderRadius: '8px', overflow: 'hidden' }}>
                {formData.items.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No items added yet. Click 'Add Item' to start.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-glass)' }}>
                      <tr>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>PRODUCT</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>QTY</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>RATE (₹)</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL (₹)</th>
                        <th style={{ padding: '0.75rem 1rem', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <select 
                              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                              value={item.product_id}
                              onChange={e => {
                                const pid = Number(e.target.value);
                                const prod = products.find(p => p.id === pid);
                                const newItems = [...formData.items];
                                newItems[idx] = { ...newItems[idx], product_id: pid, rate: prod?.selling_price || 0, total: (prod?.selling_price || 0) * newItems[idx].quantity };
                                setFormData({...formData, items: newItems});
                              }}
                            >
                              {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <input type="number" min="1" style={{ width: '80px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'right', fontSize: '0.85rem', float: 'right' }} value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '0.5rem 1rem' }}>
                            <input type="number" min="0" style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', textAlign: 'right', fontSize: '0.85rem', float: 'right' }} value={item.rate} onChange={e => handleItemChange(idx, 'rate', Number(e.target.value))} />
                          </td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            ₹{item.total.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                            <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <div style={{ background: '#fff', padding: '1rem 2rem', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'inline-flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>GRAND TOTAL</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-purple)' }}>₹{formData.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" style={{ background: 'var(--accent-neon)', color: '#fff', padding: '0.75rem 2.5rem', borderRadius: '6px', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)', fontSize: '1rem' }}>
                Save Sales Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table Section */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-glass)', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-glass)' }}>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ORDER ID</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DATE</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TOTAL AMOUNT</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>STATUS</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                No sales orders found. Click 'New Sales Order' to create one.
              </td></tr>
            ) : (
              orders.map(o => {
                const statusTheme = getStatusColor(o.status);
                return (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <ShoppingCart size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.sales_order_number}</div>
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      <Calendar size={14} /> {new Date(o.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      ₹{o.total_amount.toFixed(2)}
                    </div>
                  </td>
                  
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
                      background: statusTheme.bg,
                      color: statusTheme.color
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusTheme.dot, marginRight: '0.4rem' }}></div>
                      {o.status}
                    </span>
                  </td>
                  
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      {o.status === 'DRAFT' && (
                        <button 
                          onClick={() => handleApprove(o.id)}
                          style={{ 
                            background: 'var(--accent-neon)', color: '#fff', border: 'none',
                            padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                          }}
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleDelete(o.id)}
                        style={{ 
                          background: 'transparent', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', 
                          padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalesOrderManager;
