import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Loader, AlertTriangle, Check, RefreshCw, 
  Trash2, Eye, CheckCircle, Play, CheckSquare, Layers, 
  ClipboardList, X, Sparkles, HelpCircle
} from 'lucide-react';
import { 
  fetchAllBOMs, createBOM, deleteBOM, approveBOM, fetchBOMTree,
  fetchAllProductionOrders, createProductionOrder, checkStockAvailability,
  approveProductionOrder, startProductionOrder, completeProductionOrder,
  fetchProducts
} from '../utils/api';
import type { Product, BOMResponse, ProductionOrderResponse, ShortageItem, BOMTreeNode } from '../utils/api';

type SubTab = 'bom' | 'production';

export const BOMManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('bom');
  const [products, setProducts] = useState<Product[]>([]);
  const [boms, setBoms] = useState<BOMResponse[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrderResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals / Forms visibility
  const [showAddBOMForm, setShowAddBOMForm] = useState<boolean>(false);
  const [showAddPOForm, setShowAddPOForm] = useState<boolean>(false);
  const [selectedBOMTree, setSelectedBOMTree] = useState<BOMTreeNode | null>(null);
  const [selectedTreeBOMNumber, setSelectedTreeBOMNumber] = useState<string>('');
  const [activeCheckPOId, setActiveCheckPOId] = useState<number | null>(null);
  const [shortageResult, setShortageResult] = useState<{ can_produce: boolean; shortages: ShortageItem[] } | null>(null);

  // BOM Form States
  const [bomNumber, setBomNumber] = useState<string>('');
  const [bomProductId, setBomProductId] = useState<string>('');
  const [bomVersion, setBomVersion] = useState<string>('1.0.0');
  const [bomDescription, setBomDescription] = useState<string>('');
  const [bomLaborCost, setBomLaborCost] = useState<string>('0');
  const [bomOverheadCost, setBomOverheadCost] = useState<string>('0');
  const [bomItems, setBomItems] = useState<Array<{ material_product_id: string; quantity_required: string; wastage_percent: string; remarks: string }>>([
    { material_product_id: '', quantity_required: '1', wastage_percent: '0', remarks: '' }
  ]);

  // Production Order Form States
  const [poNumber, setPoNumber] = useState<string>('');
  const [poProductId, setPoProductId] = useState<string>('');
  const [poBomId, setPoBomId] = useState<string>('');
  const [poQuantity, setPoQuantity] = useState<string>('1');

  // Auto-generate helper names
  const generateBOMNumber = (prodId: string) => {
    if (!prodId) return '';
    const prod = products.find(p => p.id === parseInt(prodId));
    const prefix = prod ? prod.sku.substring(0, 8).toUpperCase() : 'BOM';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BOM-${prefix}-${rand}`;
  };

  const generatePONumber = (prodId: string) => {
    if (!prodId) return '';
    const prod = products.find(p => p.id === parseInt(prodId));
    const prefix = prod ? prod.sku.substring(0, 8).toUpperCase() : 'PO';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${prefix}-${rand}`;
  };

  // Load initial data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [prodsData, bomsData, posData] = await Promise.all([
        fetchProducts(),
        fetchAllBOMs(),
        fetchAllProductionOrders()
      ]);
      setProducts(prodsData);
      setBoms(bomsData);
      setProductionOrders(posData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load BOM records from backend.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBOMProductChange = (prodId: string) => {
    setBomProductId(prodId);
    if (prodId) {
      setBomNumber(generateBOMNumber(prodId));
    }
  };

  const handlePOProductChange = (prodId: string) => {
    setPoProductId(prodId);
    setPoBomId('');
    if (prodId) {
      setPoNumber(generatePONumber(prodId));
    }
  };

  // Dynamic BOM Item operations
  const handleAddBOMItemField = () => {
    setBomItems([...bomItems, { material_product_id: '', quantity_required: '1', wastage_percent: '0', remarks: '' }]);
  };

  const handleRemoveBOMItemField = (index: number) => {
    if (bomItems.length === 1) return;
    setBomItems(bomItems.filter((_, i) => i !== index));
  };

  const handleBOMItemChange = (index: number, field: string, value: string) => {
    const updated = [...bomItems];
    updated[index] = { ...updated[index], [field]: value };
    setBomItems(updated);
  };

  // Submit new BOM
  const handleSubmitBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomNumber.trim() || !bomProductId) return;

    // Validate items
    const invalidItem = bomItems.find(item => !item.material_product_id || parseFloat(item.quantity_required) <= 0);
    if (invalidItem) {
      setError('Please select a valid material product and quantity for all items.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const formattedItems = bomItems.map(item => ({
        material_product_id: parseInt(item.material_product_id),
        quantity_required: parseFloat(item.quantity_required),
        wastage_percent: parseFloat(item.wastage_percent) || 0,
        remarks: item.remarks || undefined
      }));

      await createBOM({
        bom_number: bomNumber.trim(),
        product_id: parseInt(bomProductId),
        version: bomVersion.trim(),
        description: bomDescription.trim() || undefined,
        labor_cost: parseFloat(bomLaborCost) || 0,
        overhead_cost: parseFloat(bomOverheadCost) || 0,
        items: formattedItems
      });

      setSuccessMsg(`BOM ${bomNumber} successfully created.`);
      setShowAddBOMForm(false);
      
      // Reset Form
      setBomNumber('');
      setBomProductId('');
      setBomVersion('1.0.0');
      setBomDescription('');
      setBomLaborCost('0');
      setBomOverheadCost('0');
      setBomItems([{ material_product_id: '', quantity_required: '1', wastage_percent: '0', remarks: '' }]);

      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create BOM.');
    } finally {
      setLoading(false);
    }
  };

  // Submit new Production Order
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber.trim() || !poProductId || !poBomId || parseInt(poQuantity) <= 0) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await createProductionOrder({
        production_order_number: poNumber.trim(),
        product_id: parseInt(poProductId),
        bom_id: parseInt(poBomId),
        quantity_to_produce: parseInt(poQuantity)
      });

      setSuccessMsg(`Production Order ${poNumber} registered in DRAFT.`);
      setShowAddPOForm(false);

      // Reset Form
      setPoNumber('');
      setPoProductId('');
      setPoBomId('');
      setPoQuantity('1');

      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create Production Order.');
    } finally {
      setLoading(false);
    }
  };

  // BOM Actions
  const handleApproveBOM = async (id: number) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await approveBOM(id);
      setSuccessMsg(`BOM ${res.bom_number} approved successfully.`);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to approve BOM.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBOM = async (id: number, number: string) => {
    if (!window.confirm(`Are you sure you want to delete BOM ${number}?`)) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await deleteBOM(id);
      setSuccessMsg(`BOM ${number} deleted.`);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete BOM.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTree = async (id: number, number: string) => {
    setLoading(true);
    setError('');
    try {
      const tree = await fetchBOMTree(id);
      setSelectedBOMTree(tree);
      setSelectedTreeBOMNumber(number);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load BOM tree.');
    } finally {
      setLoading(false);
    }
  };

  // Production Order Actions
  const handleCheckStock = async (id: number) => {
    setError('');
    setActiveCheckPOId(id);
    setShortageResult(null);
    try {
      const res = await checkStockAvailability(id);
      setShortageResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to check stock availability.');
      setActiveCheckPOId(null);
    }
  };

  const handleApprovePO = async (id: number, number: string) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await approveProductionOrder(id);
      setSuccessMsg(`Production Order ${number} approved and stock reserved.`);
      setShortageResult(null);
      setActiveCheckPOId(null);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to approve Production Order. Ensure stock is sufficient.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartPO = async (id: number, number: string) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await startProductionOrder(id);
      setSuccessMsg(`Production started for Order ${number}.`);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to start Production Order.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePO = async (id: number, number: string) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await completeProductionOrder(id);
      setSuccessMsg(`Production order ${number} completed! Raw materials consumed, stock updated.`);
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete Production Order.');
    } finally {
      setLoading(false);
    }
  };

  // Filter lists based on search
  const filteredBoms = boms.filter(b => {
    const s = searchTerm.toLowerCase();
    return (
      b.bom_number.toLowerCase().includes(s) ||
      (b.description || '').toLowerCase().includes(s) ||
      (b.product?.product_name || '').toLowerCase().includes(s) ||
      (b.product?.sku || '').toLowerCase().includes(s)
    );
  }).sort((a, b) => b.id - a.id);

  const filteredPOs = productionOrders.filter(po => {
    const s = searchTerm.toLowerCase();
    return (
      po.production_order_number.toLowerCase().includes(s) ||
      (po.product?.product_name || '').toLowerCase().includes(s) ||
      (po.product?.sku || '').toLowerCase().includes(s) ||
      po.status.toLowerCase().includes(s)
    );
  }).sort((a, b) => b.id - a.id);

  // Render BOM Tree Node Recursively
  const renderTreeNode = (node: BOMTreeNode, depth = 0) => {
    return (
      <div key={`${node.material_product_id}-${depth}`} style={{ marginLeft: `${depth * 24}px`, borderLeft: depth > 0 ? '1px dashed rgba(139, 92, 246, 0.3)' : 'none', paddingLeft: depth > 0 ? '12px' : '0', marginBlock: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.65rem 1rem',
          background: depth === 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
          border: depth === 0 ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: '8px',
          margin: '4px 0'
        }}>
          <span style={{ fontSize: '1rem' }}>{depth === 0 ? '📦' : '⚙️'}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.85rem' }}>{node.product_name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              SKU: <span style={{ fontFamily: 'var(--font-mono)' }}>{node.sku}</span> | Required: {parseFloat(node.quantity_required.toString())} {node.unit}
              {parseFloat(node.wastage_percent.toString()) > 0 && ` (+${node.wastage_percent}% wastage)`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              ₹{parseFloat(node.total_cost.toString()).toFixed(2)}
            </span>
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Tab Switcher Headers */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
        <button
          onClick={() => { setActiveSubTab('bom'); setSearchTerm(''); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'bom' ? '#fff' : 'var(--text-muted)',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderBottom: activeSubTab === 'bom' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <Layers size={18} />
          Bill of Materials (BOM)
        </button>
        <button
          onClick={() => { setActiveSubTab('production'); setSearchTerm(''); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: activeSubTab === 'production' ? '#fff' : 'var(--text-muted)',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            borderBottom: activeSubTab === 'production' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <ClipboardList size={18} />
          Production Orders
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="glass-panel" style={{
          padding: '1rem',
          background: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: '12px',
          color: 'var(--accent-neon)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Check size={18} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--accent-neon)', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="glass-panel" style={{
          padding: '1.25rem',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px',
          color: '#f87171',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.35rem' }}>
            <AlertTriangle size={16} /> Error Occurred
          </div>
          {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', marginTop: '-1.5rem' }}><X size={14} /></button>
        </div>
      )}

      {/* Search and Action Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder={activeSubTab === 'bom' ? 'Search by BOM #, product name, sku...' : 'Search by PO #, status, product name...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => loadData(false)}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.8rem', width: 'auto' }}
            title="Refresh logs"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          
          {activeSubTab === 'bom' ? (
            <button
              onClick={() => { setShowAddBOMForm(!showAddBOMForm); setError(''); }}
              className="scan-action-btn btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              {showAddBOMForm ? 'Close Form' : 'Create New BOM'}
            </button>
          ) : (
            <button
              onClick={() => { setShowAddPOForm(!showAddPOForm); setError(''); }}
              className="scan-action-btn btn-primary"
              style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} />
              {showAddPOForm ? 'Close Form' : 'Record Prod Order'}
            </button>
          )}
        </div>
      </div>

      {/* BOM Creation Form */}
      {showAddBOMForm && activeSubTab === 'bom' && (
        <form onSubmit={handleSubmitBOM} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            Define Bill of Materials
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Target Finished Good Product <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={bomProductId}
                onChange={(e) => handleBOMProductChange(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>BOM Number <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="text"
                required
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. BOM-SKU-1001"
                value={bomNumber}
                onChange={(e) => setBomNumber(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Version</label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="1.0.0"
                value={bomVersion}
                onChange={(e) => setBomVersion(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Estimated Labor Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                className="history-search-input"
                style={{ width: '100%' }}
                value={bomLaborCost}
                onChange={(e) => setBomLaborCost(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Overhead Charge (₹)</label>
              <input
                type="number"
                step="0.01"
                className="history-search-input"
                style={{ width: '100%' }}
                value={bomOverheadCost}
                onChange={(e) => setBomOverheadCost(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>BOM Description</label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="BOM specifications, process notes..."
                value={bomDescription}
                onChange={(e) => setBomDescription(e.target.value)}
              />
            </div>
          </div>

          {/* BOM Material Items array */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Required Raw Materials & Components
              <button
                type="button"
                onClick={handleAddBOMItemField}
                className="scan-action-btn btn-secondary"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} /> Add Component
              </button>
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {bomItems.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: '0.5rem', alignItems: 'center' }}>
                  
                  {/* Select Material */}
                  <select
                    className="camera-select"
                    style={{ width: '100%', padding: '0.5rem' }}
                    value={item.material_product_id}
                    onChange={(e) => handleBOMItemChange(idx, 'material_product_id', e.target.value)}
                  >
                    <option value="">-- Choose Component --</option>
                    {products.filter(p => p.is_active && p.id.toString() !== bomProductId).map(p => (
                      <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                    ))}
                  </select>

                  {/* Qty */}
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="history-search-input"
                    style={{ width: '100%', padding: '0.45rem' }}
                    placeholder="Qty"
                    value={item.quantity_required}
                    onChange={(e) => handleBOMItemChange(idx, 'quantity_required', e.target.value)}
                  />

                  {/* Wastage */}
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="history-search-input"
                    style={{ width: '100%', padding: '0.45rem' }}
                    placeholder="Wastage %"
                    value={item.wastage_percent}
                    onChange={(e) => handleBOMItemChange(idx, 'wastage_percent', e.target.value)}
                  />

                  {/* Remarks */}
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%', padding: '0.45rem' }}
                    placeholder="Remarks / notes"
                    value={item.remarks}
                    onChange={(e) => handleBOMItemChange(idx, 'remarks', e.target.value)}
                  />

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => handleRemoveBOMItemField(idx)}
                    disabled={bomItems.length === 1}
                    className="scan-action-btn btn-secondary"
                    style={{ width: 'auto', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
            disabled={loading}
          >
            {loading ? <Loader className="spin-anim" size={18} /> : 'Save Bill of Materials Draft'}
          </button>
        </form>
      )}

      {/* Production Order Creation Form */}
      {showAddPOForm && activeSubTab === 'production' && (
        <form onSubmit={handleSubmitPO} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
            Schedule Production Order
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Finished Product to Build <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={poProductId}
                onChange={(e) => handlePOProductChange(e.target.value)}
                required
              >
                <option value="">-- Choose Product --</option>
                {products.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.product_name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Active Approved BOM <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={poBomId}
                onChange={(e) => setPoBomId(e.target.value)}
                required
                disabled={!poProductId}
              >
                <option value="">-- Select BOM --</option>
                {boms.filter(b => b.product_id === parseInt(poProductId) && b.status === 'APPROVED').map(b => (
                  <option key={b.id} value={b.id}>{b.bom_number} (v{b.version}) - Cost: ₹{b.total_cost}</option>
                ))}
              </select>
              {poProductId && boms.filter(b => b.product_id === parseInt(poProductId) && b.status === 'APPROVED').length === 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-danger)', marginTop: '0.25rem' }}>
                  No APPROVED Bill of Materials found for this product. Define and approve a BOM first.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Production Order Number <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="text"
                required
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. PO-SKU-1001"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>Quantity to Produce <span style={{ color: 'var(--accent-danger)' }}>*</span></label>
              <input
                type="number"
                min="1"
                required
                className="history-search-input"
                style={{ width: '100%' }}
                value={poQuantity}
                onChange={(e) => setPoQuantity(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
            disabled={loading || !poBomId}
          >
            {loading ? <Loader className="spin-anim" size={18} /> : 'Schedule Production Order'}
          </button>
        </form>
      )}

      {/* Main Content Display */}
      {loading && boms.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
          <Loader className="spin-anim" size={36} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Fetching production records...</span>
        </div>
      )}

      {/* BOMs Tab List */}
      {!loading && activeSubTab === 'bom' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          {filteredBoms.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>No BOM Configurations</h4>
              <p style={{ fontSize: '0.85rem' }}>
                {searchTerm ? 'No results match your search keywords.' : 'Create a Bill of Materials structure for product assembly.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '1rem' }}>BOM Number</th>
                    <th style={{ padding: '1rem' }}>Target Finished Good</th>
                    <th style={{ padding: '1rem' }}>Version</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Total Cost</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Components Count</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBoms.map(b => (
                    <tr key={b.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'var(--transition-smooth)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: '#fff' }}>{b.bom_number}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ color: '#fff' }}>{b.product?.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{b.product?.sku}</div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>v{b.version}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#fff' }}>
                        ₹{parseFloat(b.total_cost.toString()).toFixed(2)}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Labor: ₹{b.labor_cost} | OH: ₹{b.overhead_cost}</div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: b.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(249, 115, 22, 0.12)',
                          color: b.status === 'APPROVED' ? '#22c55e' : '#f97316',
                          border: b.status === 'APPROVED' ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(249, 115, 22, 0.25)'
                        }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {b.items.length} items
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewTree(b.id, b.bom_number)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            title="View multi-level BOM Tree"
                          >
                            <Eye size={12} />
                            Tree View
                          </button>

                          {b.status === 'DRAFT' && (
                            <button
                              onClick={() => handleApproveBOM(b.id)}
                              className="scan-action-btn btn-primary"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                              title="Approve BOM"
                            >
                              <CheckCircle size={12} />
                              Approve
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteBOM(b.id, b.bom_number)}
                            className="scan-action-btn btn-secondary"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: 'auto', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
                            title="Delete BOM"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Production Orders Tab List */}
      {!loading && activeSubTab === 'production' && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          {filteredPOs.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ClipboardList size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>No Production Runs</h4>
              <p style={{ fontSize: '0.85rem' }}>
                {searchTerm ? 'No results match your search keywords.' : 'Schedule a production order run using approved BOM designs.'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '1rem' }}>Order Number</th>
                    <th style={{ padding: '1rem' }}>Finished Good Product</th>
                    <th style={{ padding: '1rem' }}>BOM Reference</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Target Qty</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Current Status</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Run Lifecycle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map(po => {
                    const statusColors: Record<string, { bg: string, text: string, border: string }> = {
                      'DRAFT': { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-muted)', border: 'rgba(255,255,255,0.1)' },
                      'APPROVED': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.25)' },
                      'IN_PRODUCTION': { bg: 'rgba(245, 158, 11, 0.12)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.25)' },
                      'COMPLETED': { bg: 'rgba(34, 197, 94, 0.12)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.25)' }
                    };

                    const style = statusColors[po.status] || statusColors['DRAFT'];

                    return (
                      <tr key={po.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'var(--transition-smooth)' }}>
                        <td style={{ padding: '1rem', fontWeight: 600, color: '#fff' }}>{po.production_order_number}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ color: '#fff' }}>{po.product?.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{po.product?.sku}</div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ color: '#fff', fontSize: '0.85rem' }}>{po.bom?.bom_number}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>v{po.bom?.version}</div>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: '#fff' }}>
                          {po.quantity_to_produce} {po.product?.unit || 'pcs'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`
                          }}>
                            {po.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                            {po.status === 'DRAFT' && (
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  onClick={() => handleCheckStock(po.id)}
                                  className="scan-action-btn btn-secondary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <HelpCircle size={12} />
                                  Check Availability
                                </button>
                                <button
                                  onClick={() => handleApprovePO(po.id, po.production_order_number)}
                                  className="scan-action-btn btn-primary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                                >
                                  <CheckCircle size={12} />
                                  Approve & Reserve
                                </button>
                              </div>
                            )}

                            {po.status === 'APPROVED' && (
                              <button
                                onClick={() => handleStartPO(po.id, po.production_order_number)}
                                className="scan-action-btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                              >
                                <Play size={12} fill="#f59e0b" />
                                Start Run
                              </button>
                            )}

                            {po.status === 'IN_PRODUCTION' && (
                              <button
                                onClick={() => handleCompletePO(po.id, po.production_order_number)}
                                className="scan-action-btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                              >
                                <CheckSquare size={12} />
                                Complete Production
                              </button>
                            )}

                            {po.status === 'COMPLETED' && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Check size={14} style={{ color: '#22c55e' }} /> Finished Good Synced
                              </span>
                            )}

                            {/* Show availability result inline under the action */}
                            {activeCheckPOId === po.id && shortageResult && (
                              <div className="glass-panel" style={{
                                marginTop: '0.5rem',
                                padding: '0.75rem',
                                background: shortageResult.can_produce ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                border: shortageResult.can_produce ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)',
                                borderRadius: '8px',
                                width: '280px',
                                textAlign: 'left'
                              }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', color: shortageResult.can_produce ? '#22c55e' : '#f87171', marginBottom: '0.25rem' }}>
                                  {shortageResult.can_produce ? <Check size={12} /> : <AlertTriangle size={12} />}
                                  {shortageResult.can_produce ? 'All materials available in stock!' : 'Materials Shortage Detected!'}
                                </div>
                                {!shortageResult.can_produce && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                                    {shortageResult.shortages.map(sh => (
                                      <div key={sh.product_id} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{sh.product_name}</span>
                                        <span style={{ fontWeight: 600, color: '#f87171' }}>Need: {parseFloat(sh.required_qty.toString())} | Short: {parseFloat(sh.shortage_qty.toString())}</span>
                                      </div>
                                    ))}
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                                      A Purchase Request has been automatically filed in backend.
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BOM Tree Structure View Modal Popup */}
      {selectedBOMTree && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="glass-panel" style={{
            position: 'relative',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '85vh',
            padding: '2rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <button 
              onClick={() => setSelectedBOMTree(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={20} />
            </button>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                Multi-level BOM Tree structure: {selectedTreeBOMNumber}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Calculates recursive materials requirements for full assembly.
              </p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {renderTreeNode(selectedBOMTree)}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <button onClick={() => setSelectedBOMTree(null)} className="scan-action-btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1.25rem' }}>
                Close Tree Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS details */}
      <style>{`
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
