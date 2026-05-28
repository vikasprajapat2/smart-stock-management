import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, ShoppingBag, Loader, AlertTriangle, 
  Check, RefreshCw, ShieldAlert, QrCode, X, Download, FileUp, FileDown, FileSpreadsheet, Edit2, Trash2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createPortal } from 'react-dom';
import { 
  fetchProducts, createProduct, updateProduct, deleteProduct, fetchCategories, 
  checkBackendConnection, fetchWarehouses, submitProductScan,
  downloadProductTemplate, exportProductsExcel, importProductsExcel
} from '../utils/api';
import type { Product, Category, Warehouse, ProductCreateInput } from '../utils/api';

export const InventoryManager: React.FC = () => {
  // Connection and data states
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // Search & Navigation
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [qrPopupProduct, setQrPopupProduct] = useState<Product | null>(null);

  // Add Product Form states
  const [name, setName] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [barcode, setBarcode] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('10');
  const [unit, setUnit] = useState<string>('pcs');
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Storage & Seeding States
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [initialStock, setInitialStock] = useState<string>('0');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

  // Auto-generation flags and helpers
  const [isSkuManuallyEdited, setIsSkuManuallyEdited] = useState<boolean>(false);
  const [isBarcodeManuallyEdited, setIsBarcodeManuallyEdited] = useState<boolean>(false);

  // Excel bulk import/export states
  const [excelLoading, setExcelLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Excel Handlers
  const handleDownloadTemplate = async () => {
    try {
      setExcelLoading(true);
      setError('');
      await downloadProductTemplate();
      setFormSuccess('Template downloaded successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to download template.');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExcelLoading(true);
      setError('');
      await exportProductsExcel();
      setFormSuccess('Products exported successfully.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to export products.');
    } finally {
      setExcelLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    try {
      setExcelLoading(true);
      setError('');
      setFormSuccess('');
      const response = await importProductsExcel(file);
      setFormSuccess(response.message || 'Products imported successfully.');
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to import products.');
    } finally {
      setExcelLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper to generate a random 10-digit numeric barcode number
  const generateRandomBarcode = (): string => {
    // Returns a random 10-digit barcode string (e.g. 8901234567)
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
  };

  // Helper to generate an SKU from product name
  const generateSkuFromName = (productName: string): string => {
    if (!productName.trim()) return '';
    const cleanName = productName
      .toUpperCase()
      .replace(/[^A-Z0-9\s-]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map(word => word.substring(0, 3))
      .join('-');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    return cleanName ? `${cleanName}-${randomSuffix}` : `PROD-${randomSuffix}`;
  };

  // Trigger manual SKU regeneration
  const handleRegenerateSku = () => {
    const newSku = generateSkuFromName(name);
    setSku(newSku);
    setIsSkuManuallyEdited(true); // Treat as manually set after manual regeneration request
  };

  // Trigger manual Barcode regeneration
  const handleRegenerateBarcode = () => {
    setBarcode(generateRandomBarcode());
    setIsBarcodeManuallyEdited(true); // Treat as manually set after manual regeneration request
  };

  // Custom name change handler to auto-prefill Barcode and SKU
  const handleNameChange = (val: string) => {
    setName(val);

    if (!val.trim()) {
      // If product name is cleared and fields weren't manually edited, reset them
      if (!isSkuManuallyEdited) setSku('');
      if (!isBarcodeManuallyEdited) setBarcode('');
      return;
    }

    // Auto-fill barcode if it is currently empty and wasn't manually edited
    if (!barcode && !isBarcodeManuallyEdited) {
      setBarcode(generateRandomBarcode());
    }

    // Auto-fill SKU from typed name if it wasn't manually edited
    if (!isSkuManuallyEdited) {
      // Reuse current random suffix if already present, to avoid changing numbers on every keypress
      let suffix = '';
      if (sku) {
        const parts = sku.split('-');
        const lastPart = parts[parts.length - 1];
        if (lastPart && /^\d{4}$/.test(lastPart)) {
          suffix = lastPart;
        }
      }
      if (!suffix) {
        suffix = Math.floor(1000 + Math.random() * 9000).toString();
      }

      const slug = val
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .map(word => word.substring(0, 3))
        .join('-');

      setSku(slug ? `${slug}-${suffix}` : `PROD-${suffix}`);
    }
  };

  // Load backend data
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    
    try {
      const connected = await checkBackendConnection();
      setIsConnected(connected);
      
      if (!connected) {
        throw new Error('Could not reach backend server at http://localhost:8000. Please ensure the FastAPI backend is running.');
      }

      // Parallel fetches for speed
      const [prodsData, catsData, whsData] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchWarehouses()
      ]);

      setProducts(prodsData);
      setCategories(catsData);
      setWarehouses(whsData);
      if (whsData.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whsData[0].id.toString());
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while loading data from the backend.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Save Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setFormLoading(true);
    setError('');
    setFormSuccess('');

    try {
      const payload: ProductCreateInput = {
        product_name: name,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        category_id: categoryId ? parseInt(categoryId) : undefined,
        selling_price: price ? parseFloat(price) : undefined,
        reorder_level: reorderLevel ? parseInt(reorderLevel) : undefined,
        unit: unit.trim() || 'pcs',
        is_active: true
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        setFormSuccess(`Product "${payload.product_name}" updated successfully!`);
      } else {
        const newProd = await createProduct(payload);
        // Seeding initial stock
        const initStockNum = parseInt(initialStock) || 0;
        if (initStockNum > 0 && selectedWarehouseId) {
          try {
            await submitProductScan({
              barcode: newProd.barcode,
              action: 'IN',
              warehouse_id: parseInt(selectedWarehouseId),
              quantity: initStockNum
            });
          } catch (scanErr) {
            console.error("Failed to seed initial stock quantity:", scanErr);
          }
        }
        setFormSuccess(`Product "${newProd.product_name}" registered successfully! ${initStockNum > 0 ? `Seeded ${initStockNum} unit(s) into warehouse.` : ''} Barcode: ${newProd.barcode}`);
      }
      
      // Reset form fields
      setName('');
      setSku('');
      setBarcode('');
      setCategoryId('');
      setPrice('');
      setReorderLevel('10');
      setUnit('pcs');
      setInitialStock('0');
      setShowAddForm(false);
      setEditingProductId(null);
      setIsSkuManuallyEdited(false);
      setIsBarcodeManuallyEdited(false);

      // Reload product list
      await loadData(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setName(p.product_name);
    setSku(p.sku || '');
    setBarcode(p.barcode || '');
    setCategoryId(p.category_id ? p.category_id.toString() : '');
    setPrice(p.selling_price ? p.selling_price.toString() : '');
    setReorderLevel(p.reorder_level ? p.reorder_level.toString() : '10');
    setUnit(p.unit || 'pcs');
    setIsSkuManuallyEdited(true);
    setIsBarcodeManuallyEdited(true);
    setShowAddForm(true);
    setError('');
    setFormSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product? It will fail if there is existing inventory.')) return;
    try {
      await deleteProduct(id);
      setFormSuccess('Product deleted successfully.');
      await loadData(true);
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  // Filtered products list
  const filteredProducts = products
    .filter(p => {
      const s = searchTerm.toLowerCase();
      return (
        (p.product_name || '').toLowerCase().includes(s) ||
        (p.sku || '').toLowerCase().includes(s) ||
        (p.barcode || '').toLowerCase().includes(s) ||
        (p.category?.category_name && p.category.category_name.toLowerCase().includes(s))
      );
    })
    .sort((a, b) => b.id - a.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Backend connection warning */}
      {!isConnected && (
        <div className="glass-panel" style={{
          padding: '1.25rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: '#fca5a5',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem'
        }}>
          <ShieldAlert size={24} style={{ color: 'var(--accent-danger)', flexShrink: 0 }} />
          <div>
            <h4 style={{ fontWeight: 700, marginBottom: '0.15rem' }}>FastAPI Backend Offline</h4>
            <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              OmniScan cannot reach the inventory database. Please run the backend API server (`uvicorn app.main:app --reload` on port 8000) to retrieve products and perform scans.
            </p>
          </div>
          <button 
            onClick={() => loadData()}
            className="scan-action-btn btn-secondary" 
            style={{ marginLeft: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.75rem', width: 'auto' }}
          >
            <RefreshCw size={12} /> Retry Connection
          </button>
        </div>
      )}

      {/* Control Actions / Search Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="history-search-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            placeholder="Search by name, SKU, barcode, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!isConnected}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleDownloadTemplate}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.65rem', width: 'auto', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.2)' }}
            title="Download Excel Template"
            disabled={!isConnected || excelLoading}
          >
            <FileSpreadsheet size={16} /> <span className="hide-mobile">Template</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.65rem', width: 'auto', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}
            title="Export Products to Excel"
            disabled={!isConnected || excelLoading}
          >
            <FileDown size={16} /> <span className="hide-mobile">Export</span>
          </button>

          <input 
            type="file" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.65rem', width: 'auto', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)' }}
            title="Import Products from Excel"
            disabled={!isConnected || excelLoading}
          >
            {excelLoading ? <Loader size={16} className="spin-anim" /> : <FileUp size={16} />} 
            <span className="hide-mobile">Import</span>
          </button>

          <button
            onClick={() => loadData(false)}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.8rem', width: 'auto' }}
            title="Refresh database"
            disabled={!isConnected || loading}
          >
            <RefreshCw size={16} className={loading ? 'spin-anim' : ''} />
          </button>
          
          <button
            onClick={() => {
              const toggled = !showAddForm;
              setShowAddForm(toggled);
              setFormSuccess('');
              if (!toggled) {
                setEditingProductId(null);
                setName('');
                setSku('');
                setBarcode('');
                setCategoryId('');
                setPrice('');
                setReorderLevel('10');
                setUnit('pcs');
              }
            }}
            className="scan-action-btn btn-primary"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            disabled={!isConnected}
          >
            <Plus size={16} />
            <span className="hide-mobile">{showAddForm ? 'Close Form' : 'Add New'}</span>
          </button>
        </div>
      </div>

      {/* Success notification */}
      {formSuccess && (
        <div className="glass-panel" style={{
          padding: '1rem',
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          color: 'var(--accent-neon)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Check size={18} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formSuccess}</span>
        </div>
      )}

      {/* Add Product Form */}
      {showAddForm && (
        <form onSubmit={handleSaveProduct} className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} style={{ color: 'var(--accent-cyan)' }} />
            {editingProductId ? 'Edit Product Details' : 'Register Product Details'}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Product Name <span style={{ color: 'var(--accent-danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. Wireless Gaming Mouse"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Product Category
              </label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">-- Auto/None --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.category_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {/* SKU */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  SKU Code (Optional)
                </label>
                {name.trim() && (
                  <button
                    type="button"
                    onClick={handleRegenerateSku}
                    className="scan-action-btn btn-secondary"
                    style={{
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.65rem',
                      width: 'auto',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: 'rgba(6, 182, 212, 0.1)',
                      color: 'var(--accent-cyan)',
                      border: '1px solid rgba(6, 182, 212, 0.2)'
                    }}
                  >
                    <RefreshCw size={8} /> Auto-Gen
                  </button>
                )}
              </div>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. ELEC-MOU-098"
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value);
                  setIsSkuManuallyEdited(true);
                }}
              />
            </div>

            {/* Barcode */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Barcode Number (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateBarcode}
                  className="scan-action-btn btn-secondary"
                  style={{
                    padding: '0.15rem 0.45rem',
                    fontSize: '0.65rem',
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    background: 'rgba(6, 182, 212, 0.1)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(6, 182, 212, 0.2)'
                  }}
                >
                  <RefreshCw size={8} /> Auto-Gen
                </button>
              </div>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. 1234567890"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setIsBarcodeManuallyEdited(true);
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
            {/* Price */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Selling Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Reorder Level */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Reorder Level
              </label>
              <input
                type="number"
                min="0"
                className="history-search-input"
                style={{ width: '100%' }}
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
              />
            </div>

            {/* Unit */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Unit
              </label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="pcs"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            {/* Initial Stock */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Initial Stock Quantity to Seed
              </label>
              <input
                type="number"
                min="0"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. 10 (Leave 0 for no stock)"
                value={initialStock}
                onChange={(e) => setInitialStock(e.target.value)}
              />
            </div>

            {/* Warehouse Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                Storage Warehouse Location
              </label>
              <select
                className="camera-select"
                style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                disabled={!(parseInt(initialStock) > 0)}
              >
                {warehouses.length === 0 ? (
                  <option value="">-- No Warehouses Loaded --</option>
                ) : (
                  warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="scan-action-btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', height: '44px' }}
            disabled={formLoading}
          >
            {formLoading ? <Loader className="spin-anim" size={18} /> : (editingProductId ? 'Update Product' : 'Save Product & Seed Initial Stock')}
          </button>
        </form>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
          <Loader className="spin-anim" size={36} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Retrieving warehouse records...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
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
        </div>
      )}

      {/* Products list grid/table */}
      {!loading && isConnected && (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          {filteredProducts.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
              <h4 style={{ color: '#fff', fontWeight: 600, marginBottom: '0.25rem' }}>No Products Found</h4>
              <p style={{ fontSize: '0.85rem' }}>
                {searchTerm ? 'Try adjusting your search keywords.' : 'Add your first product to get started!'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '1rem' }}>Product Details</th>
                    <th style={{ padding: '1rem' }}>SKU Code</th>
                    <th style={{ padding: '1rem' }}>Barcode</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Warehouse Stock</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const isLowStock = p.reorder_level !== undefined && p.stock_quantity <= p.reorder_level;
                    
                    return (
                      <tr 
                        key={p.id} 
                        className="table-row-hover"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'var(--transition-smooth)' }}
                      >
                        {/* Name & Category */}
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{p.product_name}</div>
                          {p.category && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              background: 'rgba(6, 182, 212, 0.1)', 
                              color: 'var(--accent-cyan)', 
                              padding: '0.1rem 0.35rem', 
                              borderRadius: '4px',
                              marginTop: '0.25rem',
                              display: 'inline-block'
                            }}>
                              {p.category.category_name}
                            </span>
                          )}
                        </td>

                        {/* SKU */}
                        <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {p.sku}
                        </td>

                        {/* Barcode */}
                        <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {p.barcode}
                        </td>

                        {/* Price */}
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                          {p.selling_price ? `₹${parseFloat(p.selling_price.toString()).toFixed(2)}` : '—'}
                        </td>

                        {/* Stock */}
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ 
                              fontSize: '1rem', 
                              fontWeight: 700, 
                              color: isLowStock ? '#ef4444' : '#22c55e' 
                            }}>
                              {p.stock_quantity} {p.unit || 'pcs'}
                            </span>
                            {isLowStock && (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '0.15rem', 
                                fontSize: '0.65rem', 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                color: '#f87171', 
                                padding: '0.15rem 0.35rem', 
                                borderRadius: '4px',
                                fontWeight: 600
                              }}>
                                <AlertTriangle size={8} /> Low Stock (Min: {p.reorder_level})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => setQrPopupProduct(p)}
                              className="scan-action-btn btn-secondary"
                              style={{ 
                                padding: '0.45rem', 
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: '#c084fc',
                                border: '1px solid rgba(139, 92, 246, 0.2)',
                                width: 'auto'
                              }}
                              title="QR Code"
                            >
                              <QrCode size={14} />
                            </button>
                            <button
                              onClick={() => handleEditProduct(p)}
                              className="scan-action-btn btn-secondary"
                              style={{ 
                                padding: '0.45rem', 
                                background: 'rgba(96, 165, 250, 0.1)',
                                color: '#60a5fa',
                                border: '1px solid rgba(96, 165, 250, 0.2)',
                                width: 'auto'
                              }}
                              title="Edit Product"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="scan-action-btn btn-secondary"
                              style={{ 
                                padding: '0.45rem', 
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                width: 'auto'
                              }}
                              title="Delete Product"
                            >
                              <Trash2 size={14} />
                            </button>
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

      {/* Styling injected for table animations and states */}
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

      {/* QR Code Modal Popup */}
      {qrPopupProduct && createPortal(
        <div
          onClick={() => setQrPopupProduct(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out',
            padding: '1rem'
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '380px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <button
              onClick={() => setQrPopupProduct(null)}
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

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fff', marginBottom: '0.25rem' }}>
                {qrPopupProduct.product_name}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                SKU: <span style={{ fontFamily: 'var(--font-mono)' }}>{qrPopupProduct.sku}</span>
              </p>
            </div>

            {qrPopupProduct.barcode ? (
              <div
                id="qr-code-render-box"
                style={{
                  background: '#fff',
                  padding: '1.25rem',
                  borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                <QRCodeSVG
                  value={qrPopupProduct.barcode}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <QrCode size={48} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p>No barcode assigned to this product.</p>
              </div>
            )}

            <div style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Scannable Barcode Data:</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 600, wordBreak: 'break-all' }}>
                {qrPopupProduct.barcode || 'N/A'}
              </p>
            </div>

            {qrPopupProduct.barcode && (
              <button
                className="scan-action-btn btn-primary"
                style={{ width: '100%', padding: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={() => {
                  const box = document.getElementById('qr-code-render-box');
                  const svg = box ? box.querySelector('svg') : null;
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  const img = new Image();
                  img.onload = () => {
                    canvas.width = img.width + 40;
                    canvas.height = img.height + 40;
                    if (ctx) {
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.drawImage(img, 20, 20);
                      const a = document.createElement('a');
                      a.download = `QR_${qrPopupProduct.sku}.png`;
                      a.href = canvas.toDataURL('image/png');
                      a.click();
                    }
                  };
                  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                }}
              >
                <Download size={16} />
                Download QR Image
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
