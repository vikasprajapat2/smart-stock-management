import React, { useState, useEffect } from 'react';
import { 
  Cpu, Plus, Search, Loader, AlertTriangle, Check, RefreshCw, 
  Trash2, Edit2, GitBranch, ArrowRight, UserCheck
} from 'lucide-react';
import { 
  fetchBOMs, createBOM, updateBOM, deleteBOM, approveBOM, fetchBOMTree, 
  fetchProducts, checkBackendConnection 
} from '../utils/api';
import type { 
  BOMResponse, BOMCreateInput, BOMItemCreate, BOMTreeNode, Product 
} from '../utils/api';

export const BOMManager: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const [boms, setBoms] = useState<BOMResponse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedBom, setSelectedBom] = useState<BOMResponse | null>(null);
  const [bomTree, setBomTree] = useState<BOMTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState<boolean>(false);

  // Search & Forms
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [bomNumber, setBomNumber] = useState<string>('');
  const [productId, setProductId] = useState<string>('');
  const [version, setVersion] = useState<string>('1.0.0');
  const [description, setDescription] = useState<string>('');
  const [laborCost, setLaborCost] = useState<string>('0.00');
  const [overheadCost, setOverheadCost] = useState<string>('0.00');
  const [items, setItems] = useState<BOMItemCreate[]>([]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      if (!connected) throw new Error('Backend server is offline.');

      const [bomsData, prodsData] = await Promise.all([
        fetchBOMs(),
        fetchProducts()
      ]);
      setBoms(bomsData);
      setProducts(prodsData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load BOM records.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setItems([...items, { material_product_id: products[0].id, quantity_required: 1, wastage_percent: 0, remarks: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemRowChange = (index: number, key: keyof BOMItemCreate, value: any) => {
    const copy = [...items];
    copy[index] = { ...copy[index], [key]: value } as BOMItemCreate;
    setItems(copy);
  };

  const handleSaveBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomNumber.trim() || !productId || items.length === 0) {
      setError('BOM Number, target Product, and at least one raw material are required.');
      return;
    }
    setFormLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload: BOMCreateInput = {
        bom_number: bomNumber.trim(),
        product_id: parseInt(productId),
        version: version.trim() || '1.0.0',
        description: description.trim() || undefined,
        labor_cost: parseFloat(laborCost) || 0.00,
        overhead_cost: parseFloat(overheadCost) || 0.00,
        items: items.map(item => ({
          material_product_id: item.material_product_id,
          quantity_required: item.quantity_required,
          wastage_percent: item.wastage_percent,
          remarks: item.remarks || undefined
        }))
      };

      if (editingId) {
        await updateBOM(editingId, payload);
        setSuccess(`BOM ${payload.bom_number} updated successfully.`);
      } else {
        await createBOM(payload);
        setSuccess(`BOM recipe ${payload.bom_number} created in DRAFT state.`);
      }

      setBomNumber('');
      setProductId('');
      setVersion('1.0.0');
      setDescription('');
      setLaborCost('0.00');
      setOverheadCost('0.00');
      setItems([]);
      setShowAddForm(false);
      setEditingId(null);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to compile and save BOM.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditBOM = (bom: BOMResponse) => {
    if (bom.status === 'APPROVED') {
      setError('Cannot edit an APPROVED BOM. Lock limits editing directly.');
      return;
    }
    setEditingId(bom.id);
    setBomNumber(bom.bom_number);
    setProductId(bom.product_id.toString());
    setVersion(bom.version);
    setDescription(bom.description || '');
    setLaborCost(bom.labor_cost.toString());
    setOverheadCost(bom.overhead_cost.toString());
    setItems((bom.items || []).map(i => ({
      material_product_id: i.material_product_id,
      quantity_required: i.quantity_required,
      wastage_percent: i.wastage_percent,
      remarks: i.remarks || ''
    })));
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteBOM = async (id: number) => {
    if (!confirm('Are you sure you want to delete this BOM recipe? This action cannot be undone.')) return;
    try {
      await deleteBOM(id);
      setSuccess('BOM deleted successfully.');
      if (selectedBom?.id === id) {
        setSelectedBom(null);
        setBomTree(null);
      }
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete BOM.');
    }
  };

  const handleApproveBOM = async (id: number) => {
    if (!confirm('Are you sure you want to Approve this BOM? It will lock it from future direct edits and commit this version for production.')) return;
    try {
      setLoading(true);
      const res = await approveBOM(id);
      setSuccess(`BOM ${res.bom_number} successfully Approved and activated for manufacturing!`);
      setSelectedBom(res);
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to approve BOM.');
      setLoading(false);
    }
  };

  const handleViewTree = async (bom: BOMResponse) => {
    setSelectedBom(bom);
    setTreeLoading(true);
    setBomTree(null);
    setError('');
    try {
      const tree = await fetchBOMTree(bom.id);
      setBomTree(tree);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch BOM tree calculation.');
    } finally {
      setTreeLoading(false);
    }
  };

  // Helper to render tree nodes recursively
  const renderTreeNode = (node: BOMTreeNode, depth = 0) => {
    return (
      <div key={node.material_product_id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: depth > 0 ? '1.5rem' : '0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: node.has_sub_bom ? 'rgba(139, 92, 246, 0.05)' : 'rgba(0,0,0,0.02)',
          border: node.has_sub_bom ? '1px solid rgba(139, 92, 246, 0.15)' : '1px solid rgba(0,0,0,0.04)',
          borderRadius: '8px',
          fontSize: '0.85rem'
        }}>
          {node.has_sub_bom ? <GitBranch size={16} style={{ color: 'var(--accent-purple)' }} /> : <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />}
          
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.product_name}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginLeft: '0.5rem' }}>SKU: {node.sku}</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Qty: {node.quantity_required} {node.unit || 'pcs'}</span>
            {node.wastage_percent > 0 && <span style={{ fontSize: '0.7rem', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>Wastage: {node.wastage_percent}%</span>}
            <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>₹{node.total_cost.toFixed(2)}</span>
          </div>
        </div>

        {node.children && node.children.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  const filteredBoms = boms.filter(b => {
    const q = searchTerm.toLowerCase();
    const prodName = products.find(p => p.id === b.product_id)?.product_name || '';
    return (
      b.bom_number.toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      prodName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Network offline notification */}
      {!isConnected && (
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <AlertTriangle size={24} style={{ color: 'var(--accent-danger)' }} />
          <div>
            <h4 style={{ fontWeight: 700 }}>Database Connection Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>BOM planner cannot sync with backend databases.</p>
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
            placeholder="Search BOMs by recipe number or finished product..."
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
                setEditingId(null);
                setBomNumber('');
                setProductId('');
                setVersion('1.0.0');
                setDescription('');
                setLaborCost('0.00');
                setOverheadCost('0.00');
                setItems([]);
              }
            }}
            className="scan-action-btn btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={!isConnected}
          >
            <Plus size={16} />
            <span>{showAddForm ? 'Close Wizard' : 'Create BOM Recipe'}</span>
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

      {/* Creation/Edit Form Wizard */}
      {showAddForm && (
        <form onSubmit={handleSaveBOM} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} style={{ color: 'var(--accent-purple)' }} />
            {editingId ? 'Edit BOM Recipe Details' : 'Compile New BOM Recipe'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>BOM Number/Code *</label>
              <input type="text" required className="history-search-input" style={{ width: '100%' }} placeholder="e.g. BOM-MOU-098" value={bomNumber} onChange={(e) => setBomNumber(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Target Finished Product *</label>
              <select required className="camera-select" style={{ width: '100%', padding: '0.6rem 0.75rem' }} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select Finished Good...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Recipe Version *</label>
              <input type="text" required className="history-search-input" style={{ width: '100%' }} placeholder="1.0.0" value={version} onChange={(e) => setVersion(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>BOM Description</label>
            <textarea className="history-search-input" style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} placeholder="Specify revision history or notes..." value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Assembly Labor Cost (₹)</label>
              <input type="number" className="history-search-input" style={{ width: '100%' }} value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Overhead Cost (₹)</label>
              <input type="number" className="history-search-input" style={{ width: '100%' }} value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} />
            </div>
          </div>

          {/* BOM Material Line rows */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>Raw Materials Manifest</label>
              <button type="button" onClick={handleAddItemRow} className="scan-action-btn btn-secondary" style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.75rem' }}>
                + Add Ingredient Row
              </button>
            </div>

            {items.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>No raw material rows added. Please click above to add ingredients.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                    <select
                      className="camera-select"
                      style={{ padding: '0.55rem 0.65rem', fontSize: '0.8rem' }}
                      value={item.material_product_id}
                      onChange={(e) => handleItemRowChange(idx, 'material_product_id', parseInt(e.target.value))}
                    >
                      {products.map(p => <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>)}
                    </select>

                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Qty Required"
                      value={item.quantity_required}
                      onChange={(e) => handleItemRowChange(idx, 'quantity_required', parseFloat(e.target.value) || 0)}
                    />

                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Wastage %"
                      value={item.wastage_percent}
                      onChange={(e) => handleItemRowChange(idx, 'wastage_percent', parseFloat(e.target.value) || 0)}
                    />

                    <input
                      type="text"
                      className="history-search-input"
                      style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                      placeholder="Remarks/Tolerance"
                      value={item.remarks}
                      onChange={(e) => handleItemRowChange(idx, 'remarks', e.target.value)}
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
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

          <button type="submit" className="scan-action-btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', height: '44px' }} disabled={formLoading}>
            {formLoading ? <Loader className="spin-anim" size={18} /> : (editingId ? 'Update BOM Recipe' : 'Compile & Save BOM Recipe')}
          </button>
        </form>
      )}

      {/* Dual Column Layout: BOM List (Left) and BOM Cost Tree (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: BOM List */}
        <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
          {loading && boms.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
              <Loader className="spin-anim" size={32} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fetching bill of materials...</span>
            </div>
          ) : filteredBoms.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Cpu size={48} style={{ margin: '0 auto 1rem', opacity: 0.15 }} />
              <h4 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>No BOM Recipes Found</h4>
              <p style={{ fontSize: '0.85rem' }}>Add product recipes to enable manufacturing logs.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                  <th style={{ padding: '1rem' }}>BOM Details</th>
                  <th style={{ padding: '1rem' }}>Target Product</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Total Cost Rollup</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBoms.map(bom => {
                  const targetProd = products.find(p => p.id === bom.product_id);
                  const isApproved = bom.status === 'APPROVED';

                  return (
                    <tr 
                      key={bom.id} 
                      className="table-row-hover"
                      style={{ 
                        borderBottom: '1px solid rgba(0,0,0,0.04)', 
                        transition: 'var(--transition-smooth)',
                        background: selectedBom?.id === bom.id ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleViewTree(bom)}
                    >
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{bom.bom_number}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Ver: {bom.version}</div>
                      </td>

                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{targetProd ? targetProd.product_name : `Product ID: ${bom.product_id}`}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{targetProd?.sku}</div>
                      </td>

                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ₹{bom.total_cost ? Number(bom.total_cost).toFixed(2) : '0.00'}
                      </td>

                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          background: isApproved ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: isApproved ? 'var(--accent-neon)' : '#fbbf24',
                          border: isApproved ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700
                        }}>
                          {bom.status}
                        </span>
                      </td>

                      <td style={{ padding: '1rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.45rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewTree(bom)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.45rem', width: 'auto', background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.2)' }}
                            title="View Cost Tree"
                          >
                            <GitBranch size={13} />
                          </button>
                          
                          {!isApproved && (
                            <>
                              <button
                                onClick={() => handleEditBOM(bom)}
                                className="scan-action-btn btn-secondary"
                                style={{ padding: '0.45rem', width: 'auto', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.2)' }}
                                title="Edit DRAFT"
                              >
                                <Edit2 size={13} />
                              </button>
                              
                              <button
                                onClick={() => handleApproveBOM(bom.id)}
                                className="scan-action-btn btn-secondary"
                                style={{ padding: '0.45rem', width: 'auto', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-neon)', border: '1px solid rgba(34, 197, 94, 0.2)' }}
                                title="Approve recipe"
                              >
                                <UserCheck size={13} />
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={() => handleDeleteBOM(bom.id)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.45rem', width: 'auto', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            title="Delete BOM"
                          >
                            <Trash2 size={13} />
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

        {/* Right Column: Visual BOM Cost Tree Rollup */}
        <div className="glass-panel" style={{ padding: '1.25rem', minHeight: '350px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitBranch size={16} style={{ color: 'var(--accent-purple)' }} />
            BOM Cost Tree Rollup
          </h3>

          {treeLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem' }}>
              <Loader className="spin-anim" size={24} style={{ color: 'var(--accent-purple)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Calculating aggregated costs recursively...</span>
            </div>
          ) : !selectedBom ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Cpu size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.15 }} />
              <p>Select a BOM recipe on the left to walk its nested sub-assemblies tree dynamically.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Card Summary Header */}
              <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{selectedBom.bom_number}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Target: {products.find(p => p.id === selectedBom.product_id)?.product_name}</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Material Cost Rollup</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>₹{selectedBom.total_material_cost.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Labor & Overheads</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>₹{(selectedBom.labor_cost + selectedBom.overhead_cost).toFixed(2)}</span>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px dashed rgba(0,0,0,0.08)', marginTop: '0.75rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>Total Compiled Cost</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-neon)' }}>₹{selectedBom.total_cost.toFixed(2)}</span>
                </div>
              </div>

              {/* Recursive tree list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {bomTree ? renderTreeNode(bomTree) : (
                  <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No components registered.</p>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
