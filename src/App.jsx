import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { scanReceipt } from './lib/gemini';
import './App.css';

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'dashboard'
  const inputRef = useRef(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setReceipts(data);
      }
    };

    fetchReceipts();
  }, []);


  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type.match(/image\/(jpeg|jpg|png)/)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please upload a valid image file (jpeg, jpg, png).');
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const removeImage = () => {
    setUploadedImage(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const processReceipt = async () => {
    if (!uploadedImage) return;
    setIsProcessing(true);
    try {
      const mimeType = uploadedImage.split(';')[0].split(':')[1];
      const extractedData = await scanReceipt(uploadedImage, mimeType);
      
      const { data, error } = await supabase.from('receipts').insert([
        {
          store_name: extractedData.store_name,
          total: extractedData.total,
          category: extractedData.category
        }
      ]).select();

      if (error) {
        console.error("Supabase Error:", error);
        throw new Error("Failed to save receipt to database.");
      }
      
      if (data && data.length > 0) {
        setReceipts(prev => [data[0], ...prev]);
      }
      
      setUploadedImage(null);
      setActiveTab('dashboard');
    } catch(e) {
      console.error(e);
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const categorizedReceipts = receipts.reduce((acc, receipt) => {
    const cat = receipt.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(receipt);
    return acc;
  }, {});

  return (
    <div className="app-container">
      <header className="header">
        <h1>Receipt Scanner</h1>
        <p>Extract structured data from your receipts instantly</p>
        
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Scan
          </button>
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'upload' && (
          !uploadedImage ? (
            <div 
              className={`upload-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={onButtonClick}
            >
              <input 
                ref={inputRef}
                type="file" 
                className="hidden-input" 
                accept=".jpeg,.jpg,.png,image/jpeg,image/png"
                onChange={handleChange}
              />
              <div className="upload-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <h2>Upload a receipt</h2>
              <p>Drag and drop or click to select a file</p>
              <span className="file-formats">Supported formats: JPEG, JPG, PNG</span>
            </div>
          ) : (
            <div className="preview-container">
              <div className="image-wrapper">
                <img src={uploadedImage} alt="Receipt preview" className="preview-image" />
                <button 
                  className="remove-btn" 
                  onClick={removeImage} 
                  aria-label="Remove image"
                  disabled={isProcessing}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                {isProcessing && (
                  <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>AI is scanning...</p>
                  </div>
                )}
              </div>
              <div className="action-buttons">
                <button className="btn-secondary" onClick={removeImage} disabled={isProcessing}>Try Another</button>
                <button className="btn-primary" onClick={processReceipt} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : 'Process Receipt'}
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            {Object.keys(categorizedReceipts).length === 0 ? (
              <div className="empty-state">
                <p>No receipts found. Go scan one!</p>
                <button className="btn-primary mt-4" onClick={() => setActiveTab('upload')}>Scan Receipt</button>
              </div>
            ) : (
              <div className="categories-grid">
                {Object.entries(categorizedReceipts).map(([category, items]) => (
                  <div key={category} className="category-card">
                    <div className="category-header">
                      <h3>{category}</h3>
                      <span className="badge">{items.length}</span>
                    </div>
                    <ul className="receipt-list">
                      {items.map(item => (
                        <li key={item.id} className="receipt-item">
                          <div className="receipt-info">
                            <span className="store-name">{item.store_name}</span>
                            <span className="date">{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                          <span className="total">${Number(item.total).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
