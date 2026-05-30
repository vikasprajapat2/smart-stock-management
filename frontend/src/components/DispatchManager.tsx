import React, { useState, useEffect } from 'react';
import { 
  fetchDispatches, createDispatch, type DispatchResponse, type DispatchCreateInput, type DispatchItemCreate,
  fetchSalesOrders, type SalesOrderResponse
} from '../utils/api';

const DispatchManager: React.FC = () => {
  const [dispatches, setDispatches] = useState<DispatchResponse[]>([]);
  const [orders, setOrders] = useState<SalesOrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<DispatchCreateInput>({
    dispatch_number: '',
    sales_order_id: 0,
    remarks: '',
    items: []
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [dispData, ordData] = await Promise.all([
        fetchDispatches(),
        fetchSalesOrders()
      ]);
      setDispatches(dispData);
      
      const readyOrders = ordData.filter(o => ['APPROVED', 'PARTIAL_PRODUCTION', 'READY_FOR_DISPATCH'].includes(o.status));
      setOrders(readyOrders);
      
      if (readyOrders.length > 0) {
        setFormData(f => ({...f, sales_order_id: readyOrders[0].id}));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOrderChange = (orderId: number) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    // Auto-fill items based on sales order
    const dispatchItems: DispatchItemCreate[] = order.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity
    }));
    
    setFormData({
      ...formData,
      sales_order_id: orderId,
      items: dispatchItems
    });
  };

  const handleItemQtyChange = (productId: number, qty: number) => {
    const newItems = formData.items.map(item => 
      item.product_id === productId ? { ...item, quantity: qty } : item
    );
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDispatch(formData);
      setShowForm(false);
      setFormData({ dispatch_number: '', sales_order_id: orders[0]?.id || 0, remarks: '', items: [] });
      loadData();
      alert("Dispatch created successfully! Inventory deducted.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="erp-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Dispatch Operations</h2>
        <button className="erp-button" onClick={() => {
          setShowForm(!showForm);
          if (!showForm && orders.length > 0) handleOrderChange(orders[0].id);
        }}>
          {showForm ? 'Cancel' : '+ New Dispatch'}
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label>Dispatch Number</label>
              <input 
                required
                className="erp-input"
                value={formData.dispatch_number}
                onChange={e => setFormData({...formData, dispatch_number: e.target.value})}
              />
            </div>
            <div>
              <label>Sales Order</label>
              <select 
                className="erp-input" 
                value={formData.sales_order_id}
                onChange={e => handleOrderChange(Number(e.target.value))}
              >
                {orders.map(o => <option key={o.id} value={o.id}>{o.sales_order_number} ({o.status})</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Remarks</label>
              <input 
                className="erp-input"
                value={formData.remarks}
                onChange={e => setFormData({...formData, remarks: e.target.value})}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Items to Dispatch</h4>
            {formData.items.map((item, idx) => {
              const selectedOrder = orders.find(o => o.id === formData.sales_order_id);
              const orderItemName = selectedOrder?.items.find(oi => oi.product_id === item.product_id)?.product_name || `Product ID: ${item.product_id}`;
              
              return (
                <div key={idx} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 2 }}>{orderItemName}</div>
                  <input 
                    type="number" className="erp-input" style={{ flex: 1 }}
                    placeholder="Dispatch Qty" min="1" value={item.quantity}
                    onChange={e => handleItemQtyChange(item.product_id, Number(e.target.value))}
                  />
                </div>
              );
            })}
          </div>

          <button type="submit" className="erp-button">Process Dispatch</button>
        </form>
      )}

      {loading ? <p>Loading dispatches...</p> : (
        <table className="erp-table">
          <thead>
            <tr>
              <th>Dispatch No</th>
              <th>Sales Order ID</th>
              <th>Date</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map(d => (
              <tr key={d.id}>
                <td>{d.dispatch_number}</td>
                <td>{d.sales_order_id}</td>
                <td>{new Date(d.dispatch_date).toLocaleDateString()}</td>
                <td>{d.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DispatchManager;
