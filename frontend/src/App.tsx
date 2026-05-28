import { useState, useEffect } from 'react';
import {
  Camera, Image, Clock, ShieldCheck, ShoppingBag,
  Database, LayoutDashboard, Users, Layers,
  CreditCard, Bell, ChevronRight
} from 'lucide-react';
import { ScannerActive } from './components/ScannerActive';
import { ScannerUpload } from './components/ScannerUpload';
import { ResultPanel } from './components/ResultPanel';
import { HistoryPanel, type HistoryItem } from './components/HistoryPanel';
import { InventoryManager } from './components/InventoryManager';
import {
  DashboardView, WarehouseView, SuppliersView,
  PurchaseOrdersView, OrdersView, UsersView, CategoriesView
} from './components/ERPViews';
import { InventoryRecordsView } from './components/InventoryRecordsView';
import { parseScanResult, type ParsedScanResult } from './utils/parser';
import { checkBackendConnection, fetchWarehouses, submitProductScan, fetchNotifications, markNotificationRead } from './utils/api';
import LoginModal from './components/LoginModal';
import type { Warehouse as BackendWarehouse, Notification as BackendNotification } from './utils/api';

type Tab = 'dashboard' | 'webcam' | 'upload' | 'inventory' | 'inventoryRecords' | 'warehouse' | 'procurement' | 'sales' | 'suppliers' | 'users' | 'categories' | 'history';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentResult, setCurrentResult] = useState<ParsedScanResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('access_token'));
  
  // Parse role from JWT
  const getRoleFromToken = () => {
    const token = localStorage.getItem('access_token');
    if (!token) return 'STAFF';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || 'STAFF';
    } catch {
      return 'STAFF';
    }
  };
  const [userRole, setUserRole] = useState<string>(getRoleFromToken());

  // Backend Integration States
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [warehouses, setWarehouses] = useState<BackendWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [scanAction, setScanAction] = useState<'IN' | 'OUT'>('OUT');
  const [scanQuantityInput, setScanQuantityInput] = useState<string>('1');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState<boolean>(false);

  // Load preferences, history, backend connectivity and warehouses
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('keyafusion_history');
      if (storedHistory) {
        setHistoryItems(JSON.parse(storedHistory));
      }

      const storedSound = localStorage.getItem('keyafusion_sound_enabled');
      if (storedSound !== null) {
        setSoundEnabled(storedSound === 'true');
      }
    } catch (e) {
      console.error('Failed to load localStorage preferences', e);
    }
  }, []);

  // Listen for unauthorized events to force logout
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth-unauthorized', handleUnauthorized);
    };
  }, []);

  // Update role on authentication
  useEffect(() => {
    if (isAuthenticated) {
      setUserRole(getRoleFromToken());
    }
  }, [isAuthenticated]);

  // Fetch initial data on mount, but only if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchInitialData = async () => {
      try {
        const connected = await checkBackendConnection();
        setIsBackendConnected(connected);
        if (connected) {
          const [whs, alerts] = await Promise.all([
            fetchWarehouses(),
            fetchNotifications()
          ]);
          setWarehouses(whs);
          if (whs.length > 0) {
            setSelectedWarehouseId(whs[0].id.toString());
          }
          setNotifications(alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
          setUnreadCount(alerts.filter(n => !n.is_read).length);
        }
      } catch (e) {
        console.warn('FastAPI backend connection check failed, running in local-only scanner mode:', e);
      }
    };
    fetchInitialData();
  }, [isAuthenticated]);

  // Poll connection checking silently
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await checkBackendConnection();
        setIsBackendConnected(connected);
      } catch {
        setIsBackendConnected(false);
      }
    };
    const interval = setInterval(checkConnection, 8000);
    return () => clearInterval(interval);
  }, []);

  // Poll notifications silently
  useEffect(() => {
    if (!isAuthenticated || !isBackendConnected) return;
    
    const pollNotifications = async () => {
      try {
        const alerts = await fetchNotifications();
        setNotifications(alerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        setUnreadCount(alerts.filter(n => !n.is_read).length);
      } catch (e) {
        // ignore errors during background polling
      }
    };
    
    const interval = setInterval(pollNotifications, 15000); // 15 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated, isBackendConnected]);

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  };

  const handleSetSoundEnabled = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('keyafusion_sound_enabled', String(enabled));
  };

  // Process camera / upload scans
  const handleScanSuccess = async (decodedText: string) => {
    const parsedQty = Math.max(1, parseInt(scanQuantityInput) || 1);
    if (isBackendConnected && selectedWarehouseId) {
      try {
        let finalBarcode = decodedText.trim();
        // Unwrap full inventory JSON tags
        try {
          if (finalBarcode.startsWith('{') && finalBarcode.endsWith('}')) {
            const parsedJson = JSON.parse(finalBarcode);
            if (parsedJson.barcode) finalBarcode = parsedJson.barcode;
            else if (parsedJson.sku) finalBarcode = parsedJson.sku;
          }
        } catch {
          // Ignore JSON parse errors for non-JSON barcodes
        }

        // Unwrap INVENTORY structured tags: e.g. INVENTORY:num=8496735654;sku=8496735654;items=1;qty=1%20pcs;
        if (finalBarcode.toUpperCase().startsWith('INVENTORY:')) {
          const numMatch = finalBarcode.match(/num=([^;]*)/i);
          const skuMatch = finalBarcode.match(/sku=([^;]*)/i);
          if (numMatch && numMatch[1]) {
            finalBarcode = decodeURIComponent(numMatch[1]).trim();
          } else if (skuMatch && skuMatch[1]) {
            finalBarcode = decodeURIComponent(skuMatch[1]).trim();
          }
        }

        const res = await submitProductScan({
          barcode: finalBarcode,
          action: scanAction,
          warehouse_id: parseInt(selectedWarehouseId),
          quantity: parsedQty
        });

        const txResult: ParsedScanResult = {
          type: 'transaction',
          rawValue: decodedText,
          transaction: {
            productName: res.product_name,
            sku: res.sku,
            barcode: res.barcode,
            warehouseId: res.warehouse_id,
            quantity: res.quantity,
            action: res.action,
            message: res.message,
            scannedQuantity: parsedQty,
            warehouseName: warehouses.find(w => w.id === res.warehouse_id)?.warehouse_name || `Warehouse ID: ${res.warehouse_id}`
          }
        };

        setCurrentResult(txResult);

        // Add history item
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          rawValue: decodedText,
          timestamp: Date.now(),
          type: 'transaction',
          displayName: `${res.action === 'IN' ? 'Stock IN' : 'Stock OUT'}: ${res.product_name}`
        };

        const updatedHistory = [newHistoryItem, ...historyItems.filter(item => item.rawValue !== decodedText)].slice(0, 100);
        setHistoryItems(updatedHistory);
        localStorage.setItem('omniscan_history', JSON.stringify(updatedHistory));
      } catch (e: any) {
        const failedTxResult: ParsedScanResult = {
          type: 'transaction',
          rawValue: decodedText,
          transaction: {
            productName: 'Unknown Product',
            sku: 'N/A',
            barcode: decodedText,
            warehouseId: parseInt(selectedWarehouseId),
            quantity: 0,
            action: scanAction,
            message: 'Database check failed.',
            scannedQuantity: parsedQty,
            isError: true,
            error: e.message || 'FastAPI transaction rejected.'
          }
        };

        setCurrentResult(failedTxResult);

        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          rawValue: decodedText,
          timestamp: Date.now(),
          type: 'transaction',
          displayName: `Failed Scan: ${decodedText.substring(0, 15)}...`
        };

        const updatedHistory = [newHistoryItem, ...historyItems.filter(item => item.rawValue !== decodedText)].slice(0, 100);
        setHistoryItems(updatedHistory);
        localStorage.setItem('keyafusion_history', JSON.stringify(updatedHistory));
      }

      if (window.innerWidth < 968) {
        setTimeout(() => {
          window.scrollTo({
            top: document.getElementById('result-panel-section')?.offsetTop || 500,
            behavior: 'smooth'
          });
        }, 300);
      }
      return;
    }

    // Default Offline Fallback
    const parsed = parseScanResult(decodedText);
    setCurrentResult(parsed);

    let displayName: string;
    if (parsed.type === 'upi' && parsed.upi) {
      displayName = parsed.upi.payeeName
        ? `Payment to: ${parsed.upi.payeeName}`
        : `Payment: ${parsed.upi.payeeAddress}`;
    } else if (parsed.type === 'wifi' && parsed.wifi) {
      displayName = `Wi-Fi: ${parsed.wifi.ssid}`;
    } else if (parsed.type === 'url') {
      try {
        const cleanUrl = parsed.rawValue.replace(/^https?:\/\/(www\.)?/i, '');
        displayName = `Web: ${cleanUrl.split('/')[0]}`;
      } catch {
        displayName = `Web: ${parsed.rawValue}`;
      }
    } else if (parsed.type === 'barcode') {
      displayName = `Barcode: ${parsed.productBarcode}`;
    } else if (parsed.type === 'inventory' && parsed.inventory) {
      displayName = `Stock SKU: ${parsed.inventory.sku}`;
    } else {
      displayName = parsed.rawValue.length > 28
        ? parsed.rawValue.substring(0, 25) + '...'
        : parsed.rawValue;
    }

    const newHistoryItem: HistoryItem = {
      id: Date.now().toString(),
      rawValue: decodedText,
      timestamp: Date.now(),
      type: parsed.type,
      displayName,
    };

    const updatedHistory = [newHistoryItem, ...historyItems.filter(item => item.rawValue !== decodedText)].slice(0, 100);
    setHistoryItems(updatedHistory);
    localStorage.setItem('omniscan_history', JSON.stringify(updatedHistory));

    if (window.innerWidth < 968) {
      setTimeout(() => {
        window.scrollTo({
          top: document.getElementById('result-panel-section')?.offsetTop || 500,
          behavior: 'smooth'
        });
      }, 300);
    }
  };

  const handleSelectHistoryItem = (result: ParsedScanResult) => {
    setCurrentResult(result);
    if (window.innerWidth < 968) {
      setTimeout(() => {
        window.scrollTo({
          top: document.getElementById('result-panel-section')?.offsetTop || 500,
          behavior: 'smooth'
        });
      }, 100);
    }
  };

  const handleDeleteHistoryItem = (id: string) => {
    const updatedHistory = historyItems.filter(item => item.id !== id);
    setHistoryItems(updatedHistory);
    localStorage.setItem('keyafusion_history', JSON.stringify(updatedHistory));
  };

  const handleClearAllHistory = () => {
    setHistoryItems([]);
    localStorage.removeItem('keyafusion_history');
  };

  // Close mobile sidebar on tab change
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  };

  if (!isAuthenticated) {
    return <LoginModal onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="erp-layout-container">

      {/* Mobile Overlay Backdrop */}
      <div
        className={`sidebar-mobile-overlay ${mobileSidebarOpen ? 'open' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Left Navigation Sidebar */}
      <aside className={`erp-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'mobile-open' : ''}`}>

        {/* Sidebar Brand Header */}
        <div className="sidebar-brand" style={{ gap: '0.65rem' }}>
          <div className="brand-icon-wrapper" style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.jpg" alt="Keya Fusion Logo" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'contain', background: '#fff', padding: '1px', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-meta">
              <h2 className="brand-name" style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', letterSpacing: '0.02em', background: 'linear-gradient(135deg, #f97316 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Keya Fusion</h2>
              <span className="brand-badge" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.25)', fontSize: '0.55rem', padding: '0.05rem 0.35rem' }}>TECHNOLOGY</span>
            </div>
          )}
        </div>

        {/* Navigation Sidebar List */}
        <nav className="sidebar-nav-list">

          <div className="nav-section-title">{!sidebarCollapsed && 'Core Dashboard'}</div>

          <button
            className={`sidebar-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
          >
            <LayoutDashboard size={18} />
            {!sidebarCollapsed && <span>ERP Summary</span>}
          </button>

          <div className="nav-section-title">{!sidebarCollapsed && 'Real-time Scanner'}</div>

          <button
            className={`sidebar-nav-btn ${activeTab === 'webcam' ? 'active' : ''}`}
            onClick={() => handleTabChange('webcam')}
          >
            <Camera size={18} />
            {!sidebarCollapsed && <span>Webcam Scanner</span>}
          </button>

          <button
            className={`sidebar-nav-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => handleTabChange('upload')}
          >
            <Image size={18} />
            {!sidebarCollapsed && <span>Upload image</span>}
          </button>

          <div className="nav-section-title">{!sidebarCollapsed && 'Logistics & Warehouse'}</div>

          {isBackendConnected && (
            <>
              <button
                className={`sidebar-nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => handleTabChange('inventory')}
              >
                <ShoppingBag size={18} />
                {!sidebarCollapsed && <span>Products Catalog</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'inventoryRecords' ? 'active' : ''}`}
                onClick={() => handleTabChange('inventoryRecords')}
              >
                <Database size={18} />
                {!sidebarCollapsed && <span>Direct Inventory</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'warehouse' ? 'active' : ''}`}
                onClick={() => handleTabChange('warehouse')}
              >
                <Database size={18} />
                {!sidebarCollapsed && <span>Logistics Map</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'procurement' ? 'active' : ''}`}
                onClick={() => handleTabChange('procurement')}
              >
                <Layers size={18} />
                {!sidebarCollapsed && <span>Procurement (PO)</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'sales' ? 'active' : ''}`}
                onClick={() => handleTabChange('sales')}
              >
                <CreditCard size={18} />
                {!sidebarCollapsed && <span>Sales billing</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
                onClick={() => handleTabChange('suppliers')}
              >
                <Users size={18} />
                {!sidebarCollapsed && <span>Suppliers Directory</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => handleTabChange('users')}
              >
                <Users size={18} />
                {!sidebarCollapsed && <span>Team Management</span>}
              </button>

              <button
                className={`sidebar-nav-btn ${activeTab === 'categories' ? 'active' : ''}`}
                onClick={() => handleTabChange('categories')}
              >
                <Layers size={18} />
                {!sidebarCollapsed && <span>Categories Setup</span>}
              </button>
            </>
          )}

          <div className="nav-section-title">{!sidebarCollapsed && 'Setup & Utilities'}</div>

          <button
            className={`sidebar-nav-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            <Clock size={18} />
            {!sidebarCollapsed && <span>Scan History</span>}
          </button>
          
          <button
            className="sidebar-nav-btn"
            onClick={() => {
              localStorage.removeItem('access_token');
              setIsAuthenticated(false);
            }}
          >
            <ShieldCheck size={18} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>

        </nav>

        {/* Sidebar Footer Details */}
        <div className="sidebar-footer">
          <div
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="collapse-toggle-btn"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            <ChevronRight size={18} style={{ transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: '0.3s' }} />
          </div>
        </div>

      </aside>

      {/* Main Panel Content container */}
      <div className="erp-main-panel">

        {/* Top Header navbar bar */}
        <header className="erp-topbar">

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Hamburger button - only visible on mobile/tablet */}
            <button
              className="hamburger-btn"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Toggle navigation menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                {mobileSidebarOpen
                  ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>  
                  : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                }
              </svg>
            </button>
            <span style={{ fontSize: '1.2rem' }}>📦</span>
            <div style={{ textTransform: 'capitalize' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                {activeTab === 'webcam' ? 'Live Camera Decoder' : activeTab === 'inventory' ? 'Products & Stock Management' : activeTab === 'inventoryRecords' ? 'Direct Inventory Records' : activeTab === 'procurement' ? 'Procurement purchase invoices' : activeTab === 'dashboard' ? 'ERP Dashboard Summary' : activeTab + ' hub'}
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Enterprise stock logistical portal</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>

            {/* Database indicator */}
            <div className={`db-indicator-pill ${isBackendConnected ? 'connected' : 'offline'}`}>
              <Database size={13} />
              <span>{isBackendConnected ? 'FastAPI DB Connected' : 'DB Offline (Fallback Mode)'}</span>
            </div>

            {/* Quick alert notifications count & dropdown */}
            {isBackendConnected && (
              <div style={{ position: 'relative' }}>
                <div
                  className="topbar-alerts-bell"
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  title={`${unreadCount} unread alerts`}
                >
                  <Bell size={18} className={unreadCount > 0 ? "shake-anim" : ""} />
                  {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
                </div>
                
                {showNotificationsDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '320px',
                    background: 'rgba(20, 20, 30, 0.95)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    backdropFilter: 'blur(10px)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Notifications</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{unreadCount} unread</span>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notifications yet</div>
                      ) : (
                        notifications.slice(0, 15).map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => !n.is_read && handleMarkNotificationRead(n.id)}
                            style={{ 
                              padding: '1rem', 
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: n.is_read ? 'transparent' : 'rgba(139, 92, 246, 0.05)',
                              cursor: n.is_read ? 'default' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              opacity: n.is_read ? 0.7 : 1,
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => { if (!n.is_read) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'; }}
                            onMouseLeave={(e) => { if (!n.is_read) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.05)'; }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '0.85rem', color: n.type === 'error' ? '#ef4444' : n.type === 'warning' ? '#f59e0b' : n.type === 'success' ? '#22c55e' : '#3b82f6' }}>{n.title}</strong>
                              {!n.is_read && <div style={{ width: '8px', height: '8px', background: 'var(--accent-primary)', borderRadius: '50%', flexShrink: 0 }}></div>}
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>{n.message}</span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.25rem' }}>{new Date(n.created_at).toLocaleString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.08)' }}></div>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>{userRole} User</p>

          </div>

        </header>

        {/* View render hub */}
        <div className="erp-content-viewport">

          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={(t) => setActiveTab(t)} />
          )}

          {activeTab === 'warehouse' && isBackendConnected && (
            <WarehouseView userRole={userRole} />
          )}

          {activeTab === 'suppliers' && isBackendConnected && (
            <SuppliersView userRole={userRole} />
          )}

          {activeTab === 'procurement' && isBackendConnected && (
            <PurchaseOrdersView />
          )}

          {activeTab === 'sales' && isBackendConnected && (
            <OrdersView />
          )}

          {activeTab === 'users' && isBackendConnected && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <UsersView />
            </div>
          )}

          {activeTab === 'categories' && isBackendConnected && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <CategoriesView />
            </div>
          )}

          {activeTab === 'inventory' && isBackendConnected && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <InventoryManager />
            </div>
          )}

          {activeTab === 'inventoryRecords' && isBackendConnected && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <InventoryRecordsView />
            </div>
          )}

          {/* Dual columns for scanners and history logs */}
          {(activeTab === 'webcam' || activeTab === 'upload' || activeTab === 'history') && (
            <div className="dashboard-grid">

              {/* Left column scanner panels */}
              <section className="glass-panel" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {activeTab === 'webcam' && (
                    <>
                      <Camera size={18} style={{ color: 'var(--accent-neon)' }} />
                      Live Camera Decoder
                    </>
                  )}
                  {activeTab === 'upload' && (
                    <>
                      <Image size={18} style={{ color: 'var(--accent-cyan)' }} />
                      Image Upload Decoder
                    </>
                  )}
                  {activeTab === 'history' && (
                    <>
                      <Clock size={18} style={{ color: 'var(--accent-purple)' }} />
                      Scan History logs
                    </>
                  )}
                </h2>

                {/* Real-time backend stock adjuster controls extracted and passed as props */}
                {/* View Routing */}
                {activeTab === 'webcam' && (
                  <ScannerActive
                    onScanSuccess={handleScanSuccess}
                    soundEnabled={soundEnabled}
                    setSoundEnabled={handleSetSoundEnabled}
                    topControls={isBackendConnected ? (
                      <div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Database size={14} /> Warehouse Stock Adjustment Mode
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                          {/* Select Warehouse */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Facility</label>
                            <select
                              className="camera-select"
                              style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}
                              value={selectedWarehouseId}
                              onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            >
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Stock IN / OUT Toggle */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Operation</label>
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-glass)', padding: '2px' }}>
                              <button
                                onClick={() => setScanAction('IN')}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.5rem',
                                  background: scanAction === 'IN' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                  color: scanAction === 'IN' ? '#22c55e' : 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'var(--transition-smooth)'
                                }}
                              >
                                ➕ IN
                              </button>
                              <button
                                onClick={() => setScanAction('OUT')}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.5rem',
                                  background: scanAction === 'OUT' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                  color: scanAction === 'OUT' ? '#ef4444' : 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'var(--transition-smooth)'
                                }}
                              >
                                ➖ OUT
                              </button>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div style={{ maxWidth: '100px' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Qty</label>
                            <input
                              type="number"
                              min="1"
                              className="history-search-input"
                              style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.8rem', textAlign: 'center' }}
                              value={scanQuantityInput}
                              onChange={(e) => setScanQuantityInput(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  />
                )}

                {activeTab === 'upload' && (
                  <>
                    {isBackendConnected && (
                      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', border: '1px solid rgba(139, 92, 246, 0.2)', background: 'rgba(139, 92, 246, 0.03)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Database size={14} /> Warehouse Stock Adjustment Mode
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
                          {/* Select Warehouse */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Facility</label>
                            <select
                              className="camera-select"
                              style={{ width: '100%', padding: '0.5rem 0.65rem', fontSize: '0.8rem' }}
                              value={selectedWarehouseId}
                              onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            >
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Stock IN / OUT Toggle */}
                          <div>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Operation</label>
                            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-glass)', padding: '2px' }}>
                              <button
                                onClick={() => setScanAction('IN')}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.5rem',
                                  background: scanAction === 'IN' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                                  color: scanAction === 'IN' ? '#22c55e' : 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'var(--transition-smooth)'
                                }}
                              >
                                ➕ IN
                              </button>
                              <button
                                onClick={() => setScanAction('OUT')}
                                style={{
                                  flex: 1,
                                  border: 'none',
                                  borderRadius: '4px',
                                  padding: '0.35rem 0.5rem',
                                  background: scanAction === 'OUT' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                                  color: scanAction === 'OUT' ? '#ef4444' : 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'var(--transition-smooth)'
                                }}
                              >
                                ➖ OUT
                              </button>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div style={{ maxWidth: '100px' }}>
                            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Qty</label>
                            <input
                              type="number"
                              min="1"
                              className="history-search-input"
                              style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.8rem', textAlign: 'center' }}
                              value={scanQuantityInput}
                              onChange={(e) => setScanQuantityInput(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    <ScannerUpload onScanSuccess={handleScanSuccess} soundEnabled={soundEnabled} />
                  </>
                )}

                {activeTab === 'history' && (
                  <HistoryPanel
                    items={historyItems}
                    onSelectItem={handleSelectHistoryItem}
                    onDeleteItem={handleDeleteHistoryItem}
                    onClearAll={handleClearAllHistory}
                  />
                )}
              </section>

              {/* Right column result panels */}
              <section id="result-panel-section">
                <ResultPanel
                  result={currentResult}
                  onClear={() => setCurrentResult(null)}
                />
              </section>

            </div>
          )}

        </div>

        {/* Global Footer info details */}
        <footer className="erp-footer">
          <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-neon)' }} />
            Keya Fusion Technology Pvt Ltd — Enterprise Smart Logistics ERP Suite.
          </p>
        </footer>

      </div>

      {/* Global CSS Layout adjustments injected directly */}
      <style>{`
        .erp-layout-container {
          display: flex;
          min-height: 100vh;
          background: #080a14;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
          overflow: hidden;
        }

        /* ─── SIDEBAR STYLES ───────────────────────────────── */
        .erp-sidebar {
          width: 250px;
          background: rgba(13, 17, 30, 0.85);
          border-right: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          backdrop-filter: blur(14px);
          z-index: 10;
        }
        
        .erp-sidebar.collapsed {
          width: 70px;
          padding: 1.5rem 0.5rem;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
          padding: 0 0.5rem;
        }

        .brand-icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: rgba(6, 182, 212, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brand-meta {
          min-width: 0;
        }

        .brand-name {
          font-size: 0.95rem;
          font-weight: 800;
          color: #fff;
          letter-spacing: 0.03em;
        }

        .brand-badge {
          font-size: 0.6rem;
          color: var(--accent-cyan);
          background: rgba(6, 182, 212, 0.08);
          padding: 0.1rem 0.3rem;
          border-radius: 4px;
          font-weight: 700;
        }

        .sidebar-nav-list {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          flex: 1;
          overflow-y: auto;
        }

        .nav-section-title {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin: 1rem 0 0.25rem 0.5rem;
          height: 12px;
          white-space: nowrap;
          overflow: hidden;
        }

        .sidebar-nav-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem 0.85rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-smooth);
          font-size: 0.85rem;
          font-weight: 500;
          text-align: left;
          width: 100%;
        }

        .sidebar-nav-btn:hover {
          background: rgba(255, 255, 255, 0.02);
          color: #fff;
        }

        .sidebar-nav-btn.active {
          background: rgba(6, 182, 212, 0.06);
          color: var(--accent-cyan);
          border-color: rgba(6, 182, 212, 0.15);
          font-weight: 600;
        }

        .sidebar-footer {
          margin-top: auto;
          display: flex;
          justify-content: center;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
        }

        .collapse-toggle-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.25s;
        }
        
        .collapse-toggle-btn:hover {
          background: rgba(255,255,255,0.05);
          color: #fff;
        }

        /* ─── TOP HEADER NAVBAR STYLES ───────────────────────── */
        .erp-main-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .erp-topbar {
          height: 70px;
          background: rgba(13, 17, 30, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          padding: 0 2rem;
          z-index: 5;
        }

        .db-indicator-pill {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .db-indicator-pill.connected {
          background: rgba(34, 197, 94, 0.08);
          color: var(--accent-neon);
          border: 1px solid rgba(34, 197, 94, 0.15);
        }

        .db-indicator-pill.offline {
          background: rgba(239, 68, 68, 0.08);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .topbar-alerts-bell {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(251, 191, 36, 0.08);
          border: 1px solid rgba(251, 191, 36, 0.15);
          color: #fbbf24;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .topbar-alerts-bell:hover {
          background: rgba(251, 191, 36, 0.15);
        }

        .bell-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          background: #ef4444;
          color: #fff;
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0.1rem 0.3rem;
          border-radius: 10px;
          border: 1px solid #080a14;
        }

        .erp-content-viewport {
          flex: 1;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          background-image: radial-gradient(ellipse at 40% 0%, rgba(6, 182, 212, 0.04) 0%, transparent 60%),
                            radial-gradient(ellipse at 80% 100%, rgba(139, 92, 246, 0.03) 0%, transparent 60%);
        }

        .erp-footer {
          padding: 1rem 2rem;
          background: rgba(13, 17, 30, 0.4);
          border-top: 1px solid rgba(255, 255, 255, 0.02);
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Animations */
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          20%, 60% { transform: rotate(-10deg); }
          40%, 80% { transform: rotate(10deg); }
        }
        
        .shake-anim {
          animation: shake 2s infinite ease;
        }
      `}</style>

    </div>
  );
}

export default App;
