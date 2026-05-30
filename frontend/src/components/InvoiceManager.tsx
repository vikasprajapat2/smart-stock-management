import React, { useState, useEffect } from 'react';
import { 
  fetchInvoices, createInvoice, downloadInvoicePdf, type InvoiceResponse, type InvoiceCreateInput,
  fetchSalesOrders, type SalesOrderResponse
} from '../utils/api';

const InvoiceManager: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [orders, setOrders] = useState<SalesOrderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState<InvoiceCreateInput>({
    invoice_number: '',
    sales_order_id: 0,
    customer_id: 0,
    subtotal: 0,
    tax: 0,
    grand_total: 0
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [invData, ordData] = await Promise.all([
        fetchInvoices(),
        fetchSalesOrders()
      ]);
      setInvoices(invData);
      
      const completedOrders = ordData.filter(o => o.status === 'COMPLETED');
      setOrders(completedOrders);
      
      if (completedOrders.length > 0) {
        handleOrderChange(completedOrders[0].id, completedOrders);
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

  const handleOrderChange = (orderId: number, orderList: SalesOrderResponse[] = orders) => {
    const order = orderList.find(o => o.id === orderId);
    if (!order) return;
    
    const sub = order.total_amount;
    const t = sub * 0.18; // Mock 18% GST
    
    setFormData({
      ...formData,
      sales_order_id: orderId,
      customer_id: order.customer_id,
      subtotal: sub,
      tax: t,
      grand_total: sub + t
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInvoice(formData);
      setShowForm(false);
      setFormData({ invoice_number: '', sales_order_id: 0, customer_id: 0, subtotal: 0, tax: 0, grand_total: 0 });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="erp-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Sales Invoices</h2>
        <button className="erp-button" onClick={() => {
          setShowForm(!showForm);
          if (!showForm && orders.length > 0) handleOrderChange(orders[0].id);
        }}>
          {showForm ? 'Cancel' : '+ Generate Invoice'}
        </button>
      </div>

      {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', background: '#f8f9fa', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label>Invoice Number</label>
              <input 
                required
                className="erp-input"
                value={formData.invoice_number}
                onChange={e => setFormData({...formData, invoice_number: e.target.value})}
              />
            </div>
            <div>
              <label>Sales Order (Completed)</label>
              <select 
                className="erp-input" 
                value={formData.sales_order_id}
                onChange={e => handleOrderChange(Number(e.target.value))}
              >
                {orders.map(o => <option key={o.id} value={o.id}>{o.sales_order_number} (₹{o.total_amount})</option>)}
              </select>
            </div>
          </div>
          
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal:</span>
              <span>₹{formData.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Tax (18%):</span>
              <span>₹{formData.tax.toFixed(2)}</span>
            </div>
            <hr />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              <span>Grand Total:</span>
              <span>₹{formData.grand_total.toFixed(2)}</span>
            </div>
          </div>

          <button type="submit" className="erp-button">Generate Invoice</button>
        </form>
      )}

      {loading ? <p>Loading invoices...</p> : (
        <table className="erp-table">
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Sales Order ID</th>
              <th>Date</th>
              <th>Grand Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.sales_order_id}</td>
                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                <td>₹{inv.grand_total}</td>
                <td>
                  <button className="erp-button" onClick={() => downloadInvoicePdf(inv.id)}>
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InvoiceManager;
