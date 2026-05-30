import React, { useEffect, useState } from 'react';
import { 
  QrCode, CreditCard, Wifi, Link2, FileText, 
  Copy, ExternalLink, Search, ShoppingBag, Eye, EyeOff, Check, AlertTriangle 
} from 'lucide-react';
import { type ParsedScanResult } from '../utils/parser';

interface ResultPanelProps {
  result: ParsedScanResult | null;
  onClear: () => void;
}

interface ProductDetails {
  name: string;
  brand: string;
  imageUrl: string;
  category: string;
  calories?: number;
  proteins?: number;
  carbs?: number;
  fat?: number;
  found: boolean;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ result, onClear }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  // Barcode Product States
  const [productLoading, setProductLoading] = useState<boolean>(false);
  const [productData, setProductData] = useState<ProductDetails | null>(null);

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Asynchronous Barcode API lookup (Open Food Facts)
  useEffect(() => {
    if (!result || result.type !== 'barcode' || !result.productBarcode) {
      setProductData(null);
      return;
    }

    const fetchProduct = async () => {
      setProductLoading(true);
      setProductData(null);
      try {
        const barcode = result.productBarcode;
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
        const data = await response.json();
        
        if (data && data.status === 1 && data.product) {
          const prod = data.product;
          setProductData({
            name: prod.product_name || 'Generic Barcode Product',
            brand: prod.brands || 'Unknown Brand',
            imageUrl: prod.image_url || '',
            category: prod.categories_tags?.[0]?.replace('en:', '').replace(/-/g, ' ') || 'Consumer Goods',
            calories: prod.nutriments?.['energy-kcal_100g'] !== undefined ? Math.round(prod.nutriments['energy-kcal_100g']) : undefined,
            proteins: prod.nutriments?.proteins_100g,
            carbs: prod.nutriments?.carbohydrates_100g,
            fat: prod.nutriments?.fat_100g,
            found: true
          });
        } else {
          setProductData({
            name: `Unknown Barcode (${barcode})`,
            brand: 'Not in standard food registry',
            imageUrl: '',
            category: 'Retail Product',
            found: false
          });
        }
      } catch (e) {
        console.error('Open Food Facts API failure', e);
        setProductData({
          name: `Barcode (${result.productBarcode})`,
          brand: 'Registry lookup failed offline',
          imageUrl: '',
          category: 'Retail Item',
          found: false
        });
      } finally {
        setProductLoading(false);
      }
    };

    fetchProduct();
  }, [result]);

  if (!result) {
    return (
      <div className="glass-panel results-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', height: '100%' }}>
        <QrCode size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem', opacity: 0.3 }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Waiting for Scan
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '280px', margin: '0 auto' }}>
          Scan a QR code via camera, upload an image, or click on a history log to display full results here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel results-card">
      <div className="result-card-header">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Scan Result</h3>
        
        {/* Badges based on type */}
        {result.type === 'upi' && (
          <span className="result-badge badge-upi">
            <CreditCard size={12} /> UPI / GPay
          </span>
        )}
        {result.type === 'barcode' && (
          <span className="result-badge badge-barcode">
            <ShoppingBag size={12} /> Barcode
          </span>
        )}
        {result.type === 'wifi' && (
          <span className="result-badge badge-wifi">
            <Wifi size={12} /> Wi-Fi Network
          </span>
        )}
        {result.type === 'url' && (
          <span className="result-badge badge-url">
            <Link2 size={12} /> Web Link
          </span>
        )}
        {result.type === 'text' && (
          <span className="result-badge badge-text">
            <FileText size={12} /> Plain Text
          </span>
        )}
        {result.type === 'inventory' && (
          <span className="result-badge" style={{
            background: 'rgba(139, 92, 246, 0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(139, 92, 246, 0.3)'
          }}>
            <ShoppingBag size={12} /> Stock SKU
          </span>
        )}
        {result.type === 'transaction' && (
          <span className="result-badge" style={{
            background: result.transaction?.isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: result.transaction?.isError ? '#f87171' : 'var(--accent-neon)',
            border: result.transaction?.isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <ShoppingBag size={12} /> {result.transaction?.isError ? 'Scan Failed' : 'Stock Transaction'}
          </span>
        )}
      </div>

      {/* Backend Transaction Result */}
      {result.type === 'transaction' && result.transaction && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Real-time Database Adjustment Report:
          </p>

          <div style={{
            background: result.transaction.isError 
              ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.05) 0%, rgba(15, 18, 36, 0.85) 100%)' 
              : 'linear-gradient(145deg, rgba(34, 197, 94, 0.05) 0%, rgba(15, 18, 36, 0.85) 100%)',
            border: result.transaction.isError ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1rem'
          }}>
            {/* Header Banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: result.transaction.isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                color: result.transaction.isError ? '#ef4444' : '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {result.transaction.isError ? <AlertTriangle size={22} /> : <Check size={22} />}
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem' }}>
                  {result.transaction.isError ? 'Transaction Rejected' : 'Inventory Registered'}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {result.transaction.isError ? 'Database rollbacked' : 'Database state committed'}
                </p>
              </div>
            </div>

            {/* Error Message if failed */}
            {result.transaction.isError ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '3px solid #ef4444', color: '#fca5a5', fontSize: '0.85rem' }}>
                  <strong>Error:</strong> {result.transaction.error}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Scanned Code</label>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{result.transaction.barcode}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Operation Requested</label>
                    <span style={{ color: result.transaction.action === 'IN' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      Stock {result.transaction.action === 'IN' ? 'IN (➕)' : 'OUT (➖)'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Success Details grid */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Product Name */}
                <div style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Product Name</label>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{result.transaction.productName}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>SKU Code</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{result.transaction.sku}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Barcode Number</label>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{result.transaction.barcode}</span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Adjustment</label>
                    <span style={{ 
                      fontSize: '0.9rem',
                      fontWeight: 700, 
                      color: result.transaction.action === 'IN' ? '#22c55e' : '#ef4444' 
                    }}>
                      {result.transaction.action === 'IN' ? '➕ Stock IN' : '➖ Stock OUT'} ({result.transaction.scannedQuantity} {result.transaction.scannedQuantity > 1 ? 'units' : 'unit'})
                    </span>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Final Stock Level</label>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#a78bfa' }}>
                      {result.transaction.quantity} units
                    </span>
                  </div>
                </div>

                {result.transaction.warehouseName && (
                  <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)', fontSize: '0.8rem' }}>
                    <label style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Warehouse Facility</label>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{result.transaction.warehouseName}</span>
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                  {result.transaction.message}
                </div>

              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button 
              className="scan-action-btn btn-primary"
              onClick={() => handleCopy(
                result.transaction?.isError 
                  ? `Transaction Failed!\nError: ${result.transaction?.error}\nBarcode: ${result.transaction?.barcode}`
                  : `Transaction Successful!\nProduct: ${result.transaction?.productName}\nSKU: ${result.transaction?.sku}\nAdjustment: ${result.transaction?.action} ${result.transaction?.scannedQuantity} unit(s)\nFinal stock: ${result.transaction?.quantity}\nWarehouse: ${result.transaction?.warehouseName}`
              )}
              style={{ flex: 1 }}
            >
              <Copy size={16} />
              Copy Transaction Log
            </button>
          </div>
        </div>
      )}

      {/* Inventory Content */}
      {result.type === 'inventory' && result.inventory && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Detected Stock Inventory Record:
          </p>
          <div className="wifi-card" style={{
            background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(15, 18, 36, 0.8) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--accent-purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShoppingBag size={20} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>Stock Manifest</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Warehouse SKU Decoded</p>
              </div>
            </div>

            <div className="wifi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div className="wifi-label">Product Number</div>
                <div className="wifi-value" style={{ fontFamily: 'var(--font-mono)' }}>{result.inventory.productNo || 'N/A'}</div>
              </div>
              <div>
                <div className="wifi-label">SKU Code</div>
                <div className="wifi-value" style={{ color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{result.inventory.sku || 'N/A'}</div>
              </div>
              <div>
                <div className="wifi-label">No. of Items</div>
                <div className="wifi-value" style={{ fontFamily: 'var(--font-mono)' }}>{result.inventory.items || 'N/A'}</div>
              </div>
              <div>
                <div className="wifi-label">Quantity per Item</div>
                <div className="wifi-value" style={{ fontFamily: 'var(--font-mono)' }}>{result.inventory.quantity || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              className="scan-action-btn btn-primary"
              onClick={() => handleCopy(`Product No: ${result.inventory?.productNo}\nSKU: ${result.inventory?.sku}\nItems: ${result.inventory?.items}\nQuantity: ${result.inventory?.quantity}`)}
              style={{ flex: 1 }}
            >
              <Copy size={16} />
              Copy Manifest Info
            </button>
            <a 
              className="scan-action-btn btn-secondary"
              href={`https://www.google.com/search?q=${encodeURIComponent(result.inventory?.sku || '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Search size={16} />
              Search SKU
            </a>
          </div>
        </div>
      )}

      {/* UPI Content */}
      {result.type === 'upi' && result.upi && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Detected standard UPI Payee request (Google Pay, PhonePe, Paytm compatible):
          </p>
          <div className="upi-receipt">
            {/* Payee Name banner */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.75rem',
                color: '#fbbf24'
              }}>
                <CreditCard size={24} />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {result.upi.payeeName || 'Unknown Merchant'}
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                UPI ID: {result.upi.payeeAddress}
              </p>
            </div>

            {/* Receipt Values */}
            <div className="upi-amount">
              {result.upi.amount ? `₹ ${parseFloat(result.upi.amount).toFixed(2)}` : 'Open Amount'}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <div className="upi-row">
                <span className="upi-label">Payee Address</span>
                <span className="upi-val">{result.upi.payeeAddress}</span>
              </div>
              {result.upi.note && (
                <div className="upi-row">
                  <span className="upi-label">Message / Note</span>
                  <span className="upi-val">{result.upi.note}</span>
                </div>
              )}
              {result.upi.merchantCode && (
                <div className="upi-row">
                  <span className="upi-label">Merchant Code</span>
                  <span className="upi-val">{result.upi.merchantCode}</span>
                </div>
              )}
              <div className="upi-row">
                <span className="upi-label">Currency</span>
                <span className="upi-val">{result.upi.currency || 'INR'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <a 
              className="scan-action-btn btn-primary" 
              href={result.rawValue}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flex: 1, textDecoration: 'none' }}
            >
              <ExternalLink size={16} />
              Launch Payee App
            </a>
            <button 
              className="scan-action-btn btn-secondary"
              onClick={() => handleCopy(result.upi?.payeeAddress || '')}
              style={{ padding: '0.8rem' }}
              title="Copy UPI ID"
            >
              {copied ? <Check size={18} style={{ color: 'var(--accent-neon)' }} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Barcode Content */}
      {result.type === 'barcode' && (
        <div>
          {productLoading && (
            <div style={{ padding: '2rem 0', textAlign: 'center' }}>
              <div className="skeleton-image" style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.05)',
                margin: '0 auto 1.5rem',
                position: 'relative',
                overflow: 'hidden'
              }}></div>
              <div className="skeleton-line" style={{ width: '60%', height: '14px', background: 'rgba(0,0,0,0.05)', margin: '0 auto 0.75rem', borderRadius: '4px' }}></div>
              <div className="skeleton-line" style={{ width: '40%', height: '10px', background: 'rgba(0,0,0,0.05)', margin: '0 auto', borderRadius: '4px' }}></div>
            </div>
          )}

          {!productLoading && productData && (
            <div>
              <div className="product-card">
                {productData.imageUrl ? (
                  <div className="product-img-wrapper">
                    <img src={productData.imageUrl} alt={productData.name} className="product-img" />
                  </div>
                ) : (
                  <div className="product-img-wrapper" style={{ color: 'var(--text-muted)' }}>
                    <ShoppingBag size={32} />
                  </div>
                )}
                
                <div className="product-info">
                  <h4 className="product-title">{productData.name}</h4>
                  <p className="product-brand">{productData.brand}</p>
                  <span style={{
                    fontSize: '0.75rem',
                    background: 'rgba(0,0,0,0.05)',
                    border: '1px solid var(--border-glass)',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    color: 'var(--text-muted)'
                  }}>
                    {productData.category}
                  </span>

                  {productData.found && (productData.calories !== undefined || productData.carbs !== undefined) && (
                    <div className="product-nutrients">
                      {productData.calories !== undefined && (
                        <span className="nutrient-badge">⚡ {productData.calories} kcal / 100g</span>
                      )}
                      {productData.carbs !== undefined && (
                        <span className="nutrient-badge">🍞 {productData.carbs}g Carbs</span>
                      )}
                      {productData.proteins !== undefined && (
                        <span className="nutrient-badge">💪 {productData.proteins}g Protein</span>
                      )}
                      {productData.fat !== undefined && (
                        <span className="nutrient-badge">🥑 {productData.fat}g Fat</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
                <a 
                  className="scan-action-btn btn-primary" 
                  href={`https://www.google.com/search?q=${result.productBarcode}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', flex: 1 }}
                >
                  <Search size={16} />
                  Google Search Code
                </a>
                <a 
                  className="scan-action-btn btn-secondary" 
                  href={`https://www.amazon.in/s?k=${result.productBarcode}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <ShoppingBag size={16} />
                  Amazon
                </a>
                <button 
                  className="scan-action-btn btn-secondary"
                  onClick={() => handleCopy(result.productBarcode || '')}
                  style={{ padding: '0.8rem' }}
                  title="Copy Barcode"
                >
                  {copied ? <Check size={18} style={{ color: 'var(--accent-neon)' }} /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wi-Fi QR Content */}
      {result.type === 'wifi' && result.wifi && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Detected Wi-Fi QR access details:
          </p>
          <div className="wifi-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--accent-neon)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Wifi size={20} />
              </div>
              <div>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>Wi-Fi Access</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan to Connect Ready</p>
              </div>
            </div>

            <div className="wifi-grid">
              <div>
                <div className="wifi-label">Network Name (SSID)</div>
                <div className="wifi-value">{result.wifi.ssid}</div>
              </div>
              <div>
                <div className="wifi-label">Security Type</div>
                <div className="wifi-value" style={{ textTransform: 'uppercase' }}>{result.wifi.security}</div>
              </div>
              
              {result.wifi.password && (
                <div className="wifi-password-box">
                  <div>
                    <div className="wifi-label" style={{ marginBottom: '0.15rem' }}>Network Password</div>
                    <div className="wifi-value" style={{ letterSpacing: showPassword ? 'normal' : '0.25em' }}>
                      {showPassword ? result.wifi.password : '••••••••'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-icon-only" 
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ width: '32px', height: '32px', border: 'none', background: 'rgba(0,0,0,0.05)' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button 
                      className="btn-icon-only" 
                      onClick={() => handleCopy(result.wifi?.password || '')}
                      style={{ width: '32px', height: '32px', border: 'none', background: 'rgba(0,0,0,0.05)' }}
                      title="Copy Password"
                    >
                      {copied ? <Check size={16} style={{ color: 'var(--accent-neon)' }} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              className="scan-action-btn btn-primary"
              onClick={() => handleCopy(`SSID: ${result.wifi?.ssid}\nPassword: ${result.wifi?.password}`)}
              style={{ flex: 1 }}
            >
              <Copy size={16} />
              Copy Full Credentials
            </button>
          </div>
        </div>
      )}

      {/* Web URLs */}
      {result.type === 'url' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Detected standard Web Link/URL:
          </p>
          <div className="wifi-card" style={{
            background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.05) 0%, rgba(15, 18, 36, 0.8) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--accent-purple)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Link2 size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {result.rawValue.replace(/^https?:\/\//i, '').split('/')[0]}
                </h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {result.rawValue.toLowerCase().startsWith('https') ? (
                    <span style={{ color: 'var(--accent-neon)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                      <Check size={10} /> Secure HTTPS
                    </span>
                  ) : (
                    <span style={{ color: 'var(--accent-danger)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                      <AlertTriangle size={10} /> Unencrypted HTTP
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="raw-result-text" style={{ marginTop: '0.5rem', maxHeight: '70px', fontSize: '0.8rem' }}>
              {result.rawValue}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <a 
              className="scan-action-btn btn-primary" 
              href={result.rawValue.startsWith('http') ? result.rawValue : `https://${result.rawValue}`}
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', flex: 1 }}
            >
              <ExternalLink size={16} />
              Visit Website
            </a>
            <button 
              className="scan-action-btn btn-secondary"
              onClick={() => handleCopy(result.rawValue)}
              style={{ padding: '0.8rem' }}
              title="Copy URL"
            >
              {copied ? <Check size={18} style={{ color: 'var(--accent-neon)' }} /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Plain Text */}
      {result.type === 'text' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Decoded text output ({result.rawValue.length} characters):
          </p>
          
          <div className="raw-result-text">
            {result.rawValue}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              className="scan-action-btn btn-primary"
              onClick={() => handleCopy(result.rawValue)}
              style={{ flex: 1 }}
            >
              {copied ? (
                <>
                  <Check size={16} style={{ color: '#052e16' }} />
                  Copied to Clipboard
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy Text
                </>
              )}
            </button>
            <a 
              className="scan-action-btn btn-secondary"
              href={`https://www.google.com/search?q=${encodeURIComponent(result.rawValue)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <Search size={16} />
              Web Search
            </a>
          </div>
        </div>
      )}

      {/* Clear result button */}
      <button
        onClick={onClear}
        className="scan-action-btn btn-secondary"
        style={{ width: '100%', marginTop: '1rem', borderStyle: 'dashed' }}
      >
        Clear Result
      </button>

      {/* Shimmer skeleton loaders */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-image, .skeleton-line {
          background: linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.03) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
};
