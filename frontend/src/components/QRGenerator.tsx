import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Link2, Wifi, CreditCard, FileText, 
  Download, Copy, Check, Palette, Sparkles, ShoppingBag
} from 'lucide-react';

export type QRType = 'text' | 'url' | 'wifi' | 'upi' | 'product';

interface QRGeneratorProps {
  initialValue?: string;
  initialType?: QRType;
}

export const QRGenerator: React.FC<QRGeneratorProps> = ({
  initialValue = '',
  initialType = 'text',
}) => {
  const [qrType, setQrType] = useState<QRType>(initialType);
  const [copied, setCopied] = useState<boolean>(false);

  // Forms states
  const [text, setText] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiSecurity, setWifiSecurity] = useState<string>('WPA');

  const [upiAddress, setUpiAddress] = useState<string>('');
  const [upiName, setUpiName] = useState<string>('');
  const [upiAmount, setUpiAmount] = useState<string>('');
  const [upiNote, setUpiNote] = useState<string>('');
  const [upiCurrency] = useState<string>('INR');

  // Product / SKU Forms states
  const [prodNo, setProdNo] = useState<string>('');
  const [prodSku, setProdSku] = useState<string>('');
  const [prodItems, setProdItems] = useState<string>('');
  const [prodQty, setProdQty] = useState<string>('');

  useEffect(() => {
    if (initialValue) {
      setQrType(initialType);
      if (initialType === 'text') {
        setText(initialValue);
      } else if (initialType === 'url') {
        setUrl(initialValue);
      } else if (initialType === 'product') {
        setProdNo(initialValue);
        setProdSku(initialValue);
        setProdItems('1');
        setProdQty('1 pcs');
      }
    }
  }, [initialValue, initialType]);

  // Styling Customizer states
  const [fgColor, setFgColor] = useState<string>('#0b0d19'); // Dark primary foreground
  const [bgColor, setBgColor] = useState<string>('#ffffff'); // Standard white background for readability
  const [qrSize, setQrSize] = useState<number>(240);

  // Assemble QR raw string based on form type
  const getQRValue = (): string => {
    switch (qrType) {
      case 'url':
        if (!url) return 'https://google.com'; // placeholder
        return url.startsWith('http') ? url : `https://${url}`;
      case 'wifi':
        if (!wifiSsid) return 'WIFI:S:SSID;T:WPA;P:PASSWORD;;'; // placeholder
        return `WIFI:S:${wifiSsid};T:${wifiSecurity};P:${wifiPassword};;`;
      case 'upi':
        if (!upiAddress) return 'upi://pay?pa=address@okaxis&pn=Merchant'; // placeholder
        const params = new URLSearchParams();
        params.append('pa', upiAddress);
        params.append('pn', upiName || 'Merchant');
        if (upiAmount) params.append('am', upiAmount);
        params.append('cu', upiCurrency);
        if (upiNote) params.append('tn', upiNote);
        return `upi://pay?${params.toString()}`;
      case 'product':
        if (!prodNo && !prodSku && !prodItems && !prodQty) {
          return 'INVENTORY:num=PROD-100;sku=SKU-990;items=10;qty=500g;'; // placeholder
        }
        return `INVENTORY:num=${encodeURIComponent(prodNo)};sku=${encodeURIComponent(prodSku)};items=${encodeURIComponent(prodItems)};qty=${encodeURIComponent(prodQty)};`;
      case 'text':
      default:
        return text || 'OmniScan QR Generator';
    }
  };

  // Download QR Code Canvas as PNG image
  const handleDownload = () => {
    const canvas = document.getElementById('omniscan-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    
    try {
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `omniscan_qr_${qrType}_${Date.now()}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (e) {
      console.error('Failed to export QR canvas', e);
    }
  };

  // Copy raw payload text
  const handleCopyRaw = () => {
    const val = getQRValue();
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Left side: Form Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Sub-selector tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.15)', padding: '0.3rem', borderRadius: '8px', border: '1px solid var(--border-glass)', overflowX: 'auto' }}>
          {[
            { id: 'text', label: 'Plain Text', icon: <FileText size={14} /> },
            { id: 'url', label: 'Web Link', icon: <Link2 size={14} /> },
            { id: 'wifi', label: 'Wi-Fi', icon: <Wifi size={14} /> },
            { id: 'upi', label: 'GPay/UPI', icon: <CreditCard size={14} /> },
            { id: 'product', label: 'Product Info', icon: <ShoppingBag size={14} /> }
          ].map(type => (
            <button
              key={type.id}
              onClick={() => setQrType(type.id as QRType)}
              style={{
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                background: qrType === type.id ? 'var(--bg-glass)' : 'transparent',
                color: qrType === type.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: qrType === type.id ? '1px solid var(--border-glass)' : '1px solid transparent',
                borderRadius: '6px',
                padding: '0.45rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              {type.icon}
              {type.label}
            </button>
          ))}
        </div>

        {/* Dynamic Fields */}
        <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.1)' }}>
          
          {/* Text Form */}
          {qrType === 'text' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Enter Memo / Plain Text
              </label>
              <textarea
                className="history-search-input"
                style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
                placeholder="Type messages, details, phone numbers, or note values here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
          )}

          {/* Web URL Form */}
          {qrType === 'url' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                Enter Web Address (URL)
              </label>
              <input
                type="text"
                className="history-search-input"
                style={{ width: '100%' }}
                placeholder="e.g. google.com or https://myportfolio.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          {/* Wi-Fi Form */}
          {qrType === 'wifi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Network Name (SSID)
                </label>
                <input
                  type="text"
                  className="history-search-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Home_Network"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Network Password
                  </label>
                  <input
                    type="password"
                    className="history-search-input"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    placeholder="WPA Password Key"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    disabled={wifiSecurity === 'nopass'}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Security Type
                  </label>
                  <select
                    className="camera-select"
                    style={{ width: '100%', padding: '0.6rem 0.75rem' }}
                    value={wifiSecurity}
                    onChange={(e) => setWifiSecurity(e.target.value)}
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Unsecured</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* UPI / GPay Form */}
          {qrType === 'upi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    UPI ID Address (pa) <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. receiver@okaxis"
                    value={upiAddress}
                    onChange={(e) => setUpiAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Payee Name (pn)
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. John Doe Store"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Request Amount (am)
                  </label>
                  <input
                    type="number"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. 150.00 (Optional)"
                    value={upiAmount}
                    onChange={(e) => setUpiAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Message Note (tn)
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Invoice #2031 (Optional)"
                    value={upiNote}
                    onChange={(e) => setUpiNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product SKU Form */}
          {qrType === 'product' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Product Number <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. PROD-1029"
                    value={prodNo}
                    onChange={(e) => setProdNo(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    SKU Code <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. SKU-WH-09"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Number of Items
                  </label>
                  <input
                    type="number"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. 50 (packages)"
                    value={prodItems}
                    onChange={(e) => setProdItems(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Quantity per Item / Volume
                  </label>
                  <input
                    type="text"
                    className="history-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. 250g or 5 Litres"
                    value={prodQty}
                    onChange={(e) => setProdQty(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Styling controls */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Palette size={16} style={{ color: 'var(--accent-cyan)' }} />
            Design Customizer
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                QR Foreground Color
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  style={{ width: '36px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{fgColor.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                QR Background Color
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={{ width: '36px', height: '36px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{bgColor.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <span>QR Resolution (Size)</span>
              <span>{qrSize} x {qrSize} px</span>
            </div>
            <input
              type="range"
              min="160"
              max="400"
              step="20"
              value={qrSize}
              onChange={(e) => setQrSize(parseInt(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--accent-cyan)',
                background: 'rgba(255,255,255,0.05)',
                height: '5px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

      </div>

      {/* Right side: QR Preview Output */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', textAlign: 'center', height: '100%' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
          Live QR Preview
        </h4>

        {/* QR Code Container */}
        <div style={{
          padding: '1.25rem',
          borderRadius: '16px',
          background: bgColor,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'var(--transition-smooth)'
        }}>
          <QRCodeCanvas
            id="omniscan-qr-canvas"
            value={getQRValue()}
            size={qrSize}
            fgColor={fgColor}
            bgColor={bgColor}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Data summary */}
        <div style={{ width: '100%' }}>
          <div className="raw-result-text" style={{ fontSize: '0.75rem', maxHeight: '65px', overflowY: 'auto', marginTop: '0', background: 'rgba(0,0,0,0.15)' }}>
            {getQRValue()}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <button
            onClick={handleDownload}
            className="scan-action-btn btn-primary"
            style={{ flex: 1 }}
          >
            <Download size={16} />
            Download PNG
          </button>
          
          <button
            onClick={handleCopyRaw}
            className="scan-action-btn btn-secondary"
            style={{ padding: '0.8rem' }}
            title="Copy QR Data Payload"
          >
            {copied ? <Check size={18} style={{ color: 'var(--accent-neon)' }} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

    </div>
  );
};
