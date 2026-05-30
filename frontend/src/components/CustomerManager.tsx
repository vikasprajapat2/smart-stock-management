import React, { useState, useEffect } from 'react';
import { fetchCustomers, createCustomer, deleteCustomer, type Customer, type CustomerCreateInput } from '../utils/api';
import { Users, Plus, Trash2, Mail, Phone, MapPin, Building, ShieldCheck } from 'lucide-react';

const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CustomerCreateInput>({
    customer_code: '',
    customer_name: '',
    contact_person: '',
    mobile: '',
    email: '',
    status: 'ACTIVE'
  });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await fetchCustomers();
      setCustomers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCustomer(formData);
      setShowForm(false);
      setFormData({ customer_code: '', customer_name: '', contact_person: '', mobile: '', email: '', status: 'ACTIVE' });
      loadCustomers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) return;
    try {
      await deleteCustomer(id);
      loadCustomers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="erp-card glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100%' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' }}>
              <Users size={24} style={{ color: '#3b82f6' }} />
            </div>
            Customer Directory
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Manage client accounts, contact details, and billing status.
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
          {showForm ? 'Cancel Creation' : <><Plus size={18} /> New Customer</>}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} />
          {error}
        </div>
      )}

      {/* Form Section */}
      {showForm && (
        <div style={{ background: 'rgba(255, 255, 255, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Create New Customer</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Code *</label>
                <input required placeholder="e.g. CUST-001" style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }} value={formData.customer_code} onChange={e => setFormData({...formData, customer_code: e.target.value})} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Company / Name *</label>
                <input required placeholder="Acme Corp." style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }} value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Person</label>
                <input placeholder="John Doe" style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }} value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mobile Phone</label>
                <input placeholder="+1 (555) 000-0000" style={{ padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-glass)', background: '#fff', fontSize: '0.9rem' }} value={formData.mobile} onChange={e => setFormData({...formData, mobile: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" style={{ background: 'var(--accent-neon)', color: '#fff', padding: '0.75rem 2rem', borderRadius: '6px', border: 'none', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}>
                Save Customer
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
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CLIENT DETAILS</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CONTACT</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>STATUS</th>
              <th style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                No customers found. Click 'New Customer' to add one.
              </td></tr>
            ) : (
              customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'background 0.2s', cursor: 'default' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Building size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.customer_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
                          <ShieldCheck size={12} /> {c.customer_code}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {c.contact_person && <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500 }}>{c.contact_person}</div>}
                      {c.mobile && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={12} /> {c.mobile}</div>}
                    </div>
                  </td>
                  
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
                      background: c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: c.status === 'ACTIVE' ? '#16a34a' : '#ef4444'
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.status === 'ACTIVE' ? '#16a34a' : '#ef4444', marginRight: '0.4rem' }}></div>
                      {c.status || 'ACTIVE'}
                    </span>
                  </td>
                  
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDelete(c.id)}
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
                  </td>
                  
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerManager;
