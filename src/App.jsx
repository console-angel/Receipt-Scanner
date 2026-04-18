import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { scanReceipt } from './lib/gemini';
import * as XLSX from 'xlsx';
import './App.css';

import imgFood          from './assets/category_food.png';
import imgEntertainment from './assets/category_entertainment.png';
import imgTransport     from './assets/category_transport.png';
import imgUtilities     from './assets/category_utilities.png';
import imgShopping      from './assets/category_shopping.png';
import imgOther         from './assets/category_other.png';

const categoryIcons = {
  Food:          { img: imgFood,          color: '#f59e0b', bg: '#fef3c7' },
  Entertainment: { img: imgEntertainment, color: '#8b5cf6', bg: '#ede9fe' },
  Transport:     { img: imgTransport,     color: '#3b82f6', bg: '#dbeafe' },
  Utilities:     { img: imgUtilities,     color: '#f97316', bg: '#ffedd5' },
  Shopping:      { img: imgShopping,      color: '#ec4899', bg: '#fce7f3' },
  Other:         { img: imgOther,         color: '#6b7280', bg: '#f3f4f6' },
};

const getCategoryStyle = (cat) => categoryIcons[cat] || categoryIcons['Other'];

function Logo() {
  return (
    <div className="logo-wrap">
      <div className="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" fillOpacity="0.9"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
      <span className="logo-text">BudgetScan</span>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    {
      id: 'dashboard', label: 'Dashboard',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    },
    {
      id: 'upload', label: 'Scan Receipt',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    },
  ];
  return (
    <aside className="sidebar">
      <Logo />
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          AI Powered
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, icon, img, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '22', color }}>
        {img
          ? <img src={img} alt={label} className="stat-cat-img" />
          : <span>{icon}</span>
        }
      </div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function App() {
  const [dragActive, setDragActive]       = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [receipts, setReceipts]           = useState([]);
  const [activeTab, setActiveTab]         = useState('dashboard');
  const inputRef = useRef(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      const { data, error } = await supabase.from('receipts').select('*').order('created_at', { ascending: false });
      if (!error && data) setReceipts(data);
    };
    fetchReceipts();
  }, []);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (file) => {
    if (file.type.match(/image\/(jpeg|jpg|png)/)) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadedImage(e.target.result);
      reader.readAsDataURL(file);
    } else {
      alert('Please upload a valid image file (jpeg, jpg, png).');
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const processReceipt = async () => {
    if (!uploadedImage) return;
    setIsProcessing(true);
    try {
      const mimeType = uploadedImage.split(';')[0].split(':')[1];
      const extractedData = await scanReceipt(uploadedImage, mimeType);
      const { data, error } = await supabase.from('receipts')
        .insert([{ store_name: extractedData.store_name, total: extractedData.total, category: extractedData.category }])
        .select();
      if (error) throw new Error('Failed to save receipt to database.');
      if (data?.length > 0) setReceipts(prev => [data[0], ...prev]);
      removeImage();
      setActiveTab('dashboard');
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const categorizedReceipts = receipts.reduce((acc, r) => {
    const cat = r.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const totalSpend = receipts.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const topCategory = Object.entries(categorizedReceipts).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || '—';

  const exportToExcel = () => {
    if (receipts.length === 0) {
      alert('No receipts to export.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: All Receipts ──────────────────────────────
    const receiptRows = receipts.map(r => ({
      'Store / Place':  r.store_name,
      'Category':       r.category || 'Other',
      'Total ($)':      Number(r.total).toFixed(2),
      'Date':           new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }));
    const wsAll = XLSX.utils.json_to_sheet(receiptRows);
    wsAll['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Receipts');

    // ── Sheet 2: Summary by Category ──────────────────────
    const summaryRows = Object.entries(categorizedReceipts).map(([cat, items]) => ({
      'Category':        cat,
      '# of Receipts':  items.length,
      'Total Spent ($)': items.reduce((s, i) => s + Number(i.total || 0), 0).toFixed(2),
    }));
    summaryRows.push({ 'Category': 'TOTAL', '# of Receipts': receipts.length, 'Total Spent ($)': totalSpend.toFixed(2) });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary by Category');

    XLSX.writeFile(wb, `BudgetScan_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-title">
            {activeTab === 'dashboard' ? 'Dashboard' : 'Scan Receipt'}
          </div>
          <div className="topbar-actions">
            {activeTab === 'dashboard' && receipts.length > 0 && (
              <button className="topbar-export" onClick={exportToExcel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Excel
              </button>
            )}
            <button className="topbar-cta" onClick={() => setActiveTab('upload')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Scan New Receipt
            </button>
          </div>
        </header>

        <main className="main-content">

          {activeTab === 'dashboard' && (
            <div className="dashboard-page">
              <div className="stats-row">
                <StatCard label="Total Receipts" value={receipts.length} icon="🧾" color="#16a34a" />
                <StatCard label="Total Spent" value={`$${totalSpend.toFixed(2)}`} icon="💰" color="#3b82f6" />
                <StatCard label="Top Category" value={topCategory} img={topCategory !== '—' ? getCategoryStyle(topCategory).img : undefined} icon="🏆" color="#f59e0b" />
              </div>

              {Object.keys(categorizedReceipts).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧾</div>
                  <h3>No receipts yet</h3>
                  <p>Scan your first receipt to start tracking your spending.</p>
                  <button className="btn-primary" onClick={() => setActiveTab('upload')}>Scan a Receipt</button>
                </div>
              ) : (
                <div className="categories-grid">
                  {Object.entries(categorizedReceipts).map(([category, items]) => {
                    const style = getCategoryStyle(category);
                    const catTotal = items.reduce((s, i) => s + Number(i.total || 0), 0);
                    return (
                      <div key={category} className="category-card">
                        <div className="category-header">
                          <div className="cat-icon-wrap" style={{ background: style.bg }}>
                            <img src={style.img} alt={category} className="cat-img" />
                          </div>
                          <div className="cat-meta">
                            <h3>{category}</h3>
                            <span className="cat-count">{items.length} receipt{items.length !== 1 ? 's' : ''}</span>
                          </div>
                          <span className="cat-total">${catTotal.toFixed(2)}</span>
                        </div>
                        <ul className="receipt-list">
                          {items.map(item => (
                            <li key={item.id} className="receipt-item">
                              <div className="receipt-info">
                                <span className="store-name">{item.store_name}</span>
                                <span className="date">{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                              <span className="total">${Number(item.total).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="upload-page">
              <div className="upload-page-inner">
                <div className="scan-intro">
                  <h2>Scan a Receipt</h2>
                  <p>Upload a photo and our AI will extract the store, total, and spending category automatically.</p>
                </div>
                {!uploadedImage ? (
                  <div
                    className={`upload-zone ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current.click()}
                  >
                    <input ref={inputRef} type="file" className="hidden-input" accept=".jpeg,.jpg,.png,image/jpeg,image/png" onChange={handleChange} />
                    <div className="upload-icon-circle">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <h3>Drop your receipt here</h3>
                    <p>or <span className="upload-link">browse files</span></p>
                    <span className="file-formats">Supports JPEG, JPG, PNG</span>
                  </div>
                ) : (
                  <div className="preview-container">
                    <div className="image-wrapper">
                      <img src={uploadedImage} alt="Receipt preview" className="preview-image" />
                      <button className="remove-btn" onClick={removeImage} disabled={isProcessing} aria-label="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                      {isProcessing && (
                        <div className="processing-overlay">
                          <div className="spinner"/>
                          <p>AI is reading your receipt…</p>
                        </div>
                      )}
                    </div>
                    <div className="action-buttons">
                      <button className="btn-secondary" onClick={removeImage} disabled={isProcessing}>Try Another</button>
                      <button className="btn-primary" onClick={processReceipt} disabled={isProcessing}>
                        {isProcessing ? 'Processing…' : '✨ Process Receipt'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
