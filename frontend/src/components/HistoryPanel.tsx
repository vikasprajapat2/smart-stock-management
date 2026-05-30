import React, { useState } from 'react';
import { 
  Trash2, Download, Search, Clock, 
  CreditCard, Wifi, Link2, FileText, ShoppingBag 
} from 'lucide-react';
import { type ParsedScanResult, parseScanResult } from '../utils/parser';

export interface HistoryItem {
  id: string;
  rawValue: string;
  timestamp: number;
  type: string;
  displayName: string;
}

interface HistoryPanelProps {
  items: HistoryItem[];
  onSelectItem: (result: ParsedScanResult) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  items,
  onSelectItem,
  onDeleteItem,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Format date helper
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.rawValue.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    return item.type === activeFilter && matchesSearch;
  });

  // Export to CSV
  const exportToCSV = () => {
    if (items.length === 0) return;
    
    const headers = ['ID', 'Type', 'Display Name', 'Raw Value', 'Timestamp', 'Date'];
    const rows = items.map(item => [
      item.id,
      item.type,
      `"${item.displayName.replace(/"/g, '""')}"`,
      `"${item.rawValue.replace(/"/g, '""')}"`,
      item.timestamp,
      new Date(item.timestamp).toISOString()
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `omniscan_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleItemClick = (item: HistoryItem) => {
    const parsed = parseScanResult(item.rawValue);
    onSelectItem(parsed);
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'upi': return <CreditCard size={16} />;
      case 'barcode': return <ShoppingBag size={16} />;
      case 'wifi': return <Wifi size={16} />;
      case 'url': return <Link2 size={16} />;
      case 'inventory': return <ShoppingBag size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getCategoryColorClass = (type: string) => {
    switch (type) {
      case 'upi': return 'icon-upi';
      case 'barcode': return 'icon-barcode';
      case 'wifi': return 'icon-wifi';
      case 'url': return 'icon-url';
      case 'inventory': return 'icon-url';
      default: return 'icon-text';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="history-header">
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} style={{ color: 'var(--accent-purple)' }} />
          Scan History
        </h3>
        
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn-icon-only" 
              onClick={exportToCSV}
              title="Export History to CSV"
              style={{ width: '36px', height: '36px' }}
            >
              <Download size={16} />
            </button>
            <button 
              className="btn-icon-only" 
              onClick={() => {
                if (window.confirm('Are you sure you want to clear your scanning history? This action is irreversible.')) {
                  onClearAll();
                }
              }}
              title="Wipe All History"
              style={{ width: '36px', height: '36px', color: 'rgba(244, 63, 94, 0.7)' }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="empty-history-text">
          <Clock size={40} style={{ margin: '0 auto 1rem', color: 'var(--text-muted)', opacity: 0.3 }} />
          <p>Your scan history is empty.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            Codes you scan will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* Search Row */}
          <div className="history-search-row">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="history-search-input"
                placeholder="Search scans..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {/* Categories Tab Selector */}
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'upi', label: 'Payments' },
              { id: 'barcode', label: 'Barcodes' },
              { id: 'inventory', label: 'Inventory' },
              { id: 'wifi', label: 'Wi-Fi' },
              { id: 'url', label: 'Links' },
              { id: 'text', label: 'Text' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                style={{
                  background: activeFilter === filter.id ? 'var(--accent-purple)' : 'rgba(0,0,0,0.03)',
                  color: activeFilter === filter.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: activeFilter === filter.id ? 'var(--accent-purple)' : 'var(--border-glass)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="history-list">
            {filteredItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
                No matches found in history.
              </p>
            ) : (
              filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className="history-item"
                  onClick={() => handleItemClick(item)}
                >
                  <div className="history-item-left">
                    <div className={`history-item-icon ${getCategoryColorClass(item.type)}`}>
                      {getCategoryIcon(item.type)}
                    </div>
                    <div className="history-item-info">
                      <div className="history-item-text">{item.displayName}</div>
                      <div className="history-item-date">{formatDate(item.timestamp)}</div>
                    </div>
                  </div>
                  
                  <button 
                    className="history-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteItem(item.id);
                    }}
                    title="Delete log entry"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};
