import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { scanReceipt } from './lib/gemini';
import './App.css';

import imgFood from './assets/category_food.png';
import imgEntertainment from './assets/category_entertainment.png';
import imgTransport from './assets/category_transport.png';
import imgUtilities from './assets/category_utilities.png';
import imgShopping from './assets/category_shopping.png';
import imgOther from './assets/category_other.png';

const categoryIcons = {
  Food: { img: imgFood, color: '#23CE6B', bg: '#E5F9EE' },
  Entertainment: { img: imgEntertainment, color: '#272D2D', bg: '#EDF5FC' },
  Transport: { img: imgTransport, color: '#4F6172', bg: '#E7EEF6' },
  Utilities: { img: imgUtilities, color: '#6C7D8F', bg: '#EAF1F8' },
  Shopping: { img: imgShopping, color: '#5B6A79', bg: '#E8EFF7' },
  Other: { img: imgOther, color: '#A39BA8', bg: '#EDF5FC' },
};

const FILTER_MODES = {
  ALL: 'all',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  LAST_3_MONTHS: 'last3Months',
};

const THEME_STORAGE_KEY = 'receiptiFy-theme';
const LOGIN_ATTEMPTS_STORAGE_KEY = 'receiptiFy-login-attempts';
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const getCategoryStyle = (cat) => categoryIcons[cat] || categoryIcons.Other;

const getReceiptDateValue = (receipt) => receipt.receipt_date || receipt.created_at;

const getReceiptMonthKey = (receipt) => {
  const sourceDate = getReceiptDateValue(receipt);
  if (!sourceDate) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
    return sourceDate.slice(0, 7);
  }

  const parsedDate = new Date(sourceDate);
  if (Number.isNaN(parsedDate.getTime())) return '';

  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
};

const formatReceiptDate = (value) => {
  if (!value) return 'Date unavailable';

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  if (Number.isNaN(parsedDate.getTime())) return 'Date unavailable';

  return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthIndex = (monthKey) => {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + month;
};

const shiftMonthKey = (monthKey, offset) => {
  const [yearPart, monthPart] = monthKey.split('-').map(Number);
  const zeroBasedMonth = monthPart - 1 + offset;
  const shiftedDate = new Date(yearPart, zeroBasedMonth, 1);
  return `${shiftedDate.getFullYear()}-${String(shiftedDate.getMonth() + 1).padStart(2, '0')}`;
};

const getQuickFilterLabel = (filterMode) => {
  switch (filterMode) {
    case FILTER_MODES.THIS_MONTH:
      return 'This month';
    case FILTER_MODES.LAST_MONTH:
      return 'Last month';
    case FILTER_MODES.LAST_3_MONTHS:
      return 'Last 3 months';
    default:
      return 'All time';
  }
};

const getReceiptsCacheKey = (userId) => `receiptiFy-receipts-cache:${userId}`;

const getStoredTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getAttemptState = () => {
  const now = Date.now();
  const fallback = { attempts: [], lockedUntil: null };

  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.attempts)) return fallback;

    const attempts = parsed.attempts.filter((timestamp) => now - Number(timestamp) < LOGIN_ATTEMPT_WINDOW_MS);
    const lockedUntil = parsed.lockedUntil && Number(parsed.lockedUntil) > now ? Number(parsed.lockedUntil) : null;

    return { attempts, lockedUntil };
  } catch {
    return fallback;
  }
};

const saveAttemptState = (state) => {
  localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(state));
};

const clearAttemptState = () => {
  localStorage.removeItem(LOGIN_ATTEMPTS_STORAGE_KEY);
};

const getLoginRateLimitStatus = () => {
  const now = Date.now();
  const state = getAttemptState();

  if (state.lockedUntil && state.lockedUntil > now) {
    return {
      blocked: true,
      retryInMs: state.lockedUntil - now,
      remaining: 0,
    };
  }

  return {
    blocked: false,
    retryInMs: 0,
    remaining: Math.max(LOGIN_ATTEMPT_LIMIT - state.attempts.length, 0),
  };
};

const registerFailedLoginAttempt = () => {
  const now = Date.now();
  const state = getAttemptState();
  const attempts = [...state.attempts.filter((timestamp) => now - Number(timestamp) < LOGIN_ATTEMPT_WINDOW_MS), now];
  const shouldLock = attempts.length >= LOGIN_ATTEMPT_LIMIT;
  const nextState = {
    attempts,
    lockedUntil: shouldLock ? now + LOGIN_ATTEMPT_WINDOW_MS : null,
  };

  saveAttemptState(nextState);
  return getLoginRateLimitStatus();
};

function Logo() {
  return (
    <div className="logo-wrap">
      <div className="logo-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" fillOpacity="0.9" />
          <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      <span className="logo-text">ReceiptiFy</span>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      id: 'upload',
      label: 'Scan Receipt',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 .99-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51.99H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="sidebar">
      <Logo />
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          AI Powered
        </div>
      </div>
    </aside>
  );
}

function StatCard({ label, value, icon, img, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: `${color}22`, color }}>
        {img ? <img src={img} alt={label} className="stat-cat-img" loading="lazy" decoding="async" /> : <span>{icon}</span>}
      </div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function AuthGate({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authBusy,
  authError,
  authNotice,
  onSubmit,
}) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <Logo />
        <p className="auth-kicker">Secure account access</p>
        <h1>{authMode === 'login' ? 'Sign in to your account' : 'Create your account'}</h1>
        <p className="auth-copy">
          {authMode === 'login'
            ? 'Use your email and password to access your private receipts dashboard.'
            : 'Create a secure account and start scanning receipts into your own private dataset.'}
        </p>
        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Enter your password"
              required
              minLength={8}
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {authError && <p className="auth-message error">{authError}</p>}
          {authNotice && <p className="auth-message notice">{authNotice}</p>}
          <button className="btn-primary auth-submit" type="submit" disabled={authBusy}>
            {authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <button
          type="button"
          className="auth-toggle"
          onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          disabled={authBusy}
        >
          {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterMode, setFilterMode] = useState(FILTER_MODES.ALL);

  const [theme, setTheme] = useState(() => getStoredTheme());

  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  const [settingsUsername, setSettingsUsername] = useState('');
  const [settingsUsernameSaved, setSettingsUsernameSaved] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    const bootstrapAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('Session fetch error:', error);

      if (!mounted) return;

      setSession(data?.session ?? null);
      setUser(data?.session?.user ?? null);
      setAuthLoading(false);
    };

    bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setReceipts([]);
        setSettingsUsername('');
        setSettingsUsernameSaved('');
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const loadCachedReceipts = () => {
      try {
        const cached = localStorage.getItem(getReceiptsCacheKey(user.id));
        if (!cached) return;
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setReceipts(parsed);
        }
      } catch {
        // Ignore invalid cache.
      }
    };

    const fetchReceipts = async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch receipts error:', error);
        return;
      }

      setReceipts(data || []);
      localStorage.setItem(getReceiptsCacheKey(user.id), JSON.stringify(data || []));
    };

    const fetchProfile = async () => {
      const { data, error } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (error) {
        console.error('Fetch profile error:', error);
        setSettingsUsername(user.email?.split('@')[0] || '');
        setSettingsUsernameSaved(user.email?.split('@')[0] || '');
        return;
      }

      const fallback = user.email?.split('@')[0] || '';
      const name = data?.username || fallback;
      setSettingsUsername(name);
      setSettingsUsernameSaved(name);
    };

    loadCachedReceipts();
    fetchReceipts();
    fetchProfile();
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!settingsMessage) return undefined;

    const timer = window.setTimeout(() => {
      setSettingsMessage('');
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [settingsMessage]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setAuthBusy(true);

    try {
      if (authMode === 'login') {
        const rate = getLoginRateLimitStatus();
        if (rate.blocked) {
          const minutes = Math.ceil(rate.retryInMs / 60000);
          throw new Error(`Too many failed login attempts. Try again in ${minutes} minute(s).`);
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) {
          const updatedRate = registerFailedLoginAttempt();
          if (updatedRate.blocked) {
            throw new Error('Too many failed login attempts. Login is temporarily locked for 15 minutes.');
          }

          throw new Error(`${error.message} (${updatedRate.remaining} attempts left in this window)`);
        }

        clearAttemptState();
      } else {
        const { error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw new Error(error.message);

        setAuthNotice('Account created. Check your email for confirmation if your Supabase project requires it.');
      }

      setAuthPassword('');
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files?.[0]) handleFile(event.dataTransfer.files[0]);
  };

  const handleChange = (event) => {
    event.preventDefault();
    if (event.target.files?.[0]) handleFile(event.target.files[0]);
  };

  const handleFile = (file) => {
    if (file.type.match(/image\/(jpeg|jpg|png)/)) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImage(event.target.result);
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
    if (!uploadedImage || !user?.id) return;

    setIsProcessing(true);
    try {
      const mimeType = uploadedImage.split(';')[0].split(':')[1];
      const extractedData = await scanReceipt(uploadedImage, mimeType);

      const { data, error } = await supabase
        .from('receipts')
        .insert([
          {
            user_id: user.id,
            store_name: extractedData.store_name,
            total: extractedData.total,
            category: extractedData.category,
            receipt_date: extractedData.receipt_date,
          },
        ])
        .select();

      if (error) throw new Error('Failed to save receipt to database. Ensure user_id column and RLS policies are configured.');

      if (data?.length > 0) {
        const next = [data[0], ...receipts];
        setReceipts(next);
        localStorage.setItem(getReceiptsCacheKey(user.id), JSON.stringify(next));
      }

      removeImage();
      setActiveTab('dashboard');
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteReceipt = async (id) => {
    if (!user?.id) return;

    const { error } = await supabase.from('receipts').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      console.error('Delete error:', error);
      alert('Failed to delete receipt. Please try again.');
      return;
    }

    const next = receipts.filter((receipt) => receipt.id !== id);
    setReceipts(next);
    localStorage.setItem(getReceiptsCacheKey(user.id), JSON.stringify(next));
  };

  const exportToCSV = () => {
    if (filteredReceipts.length === 0) {
      alert('No receipts to export.');
      return;
    }

    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const lines = [];
    lines.push('ALL RECEIPTS');
    lines.push(['Store / Place', 'Category', 'Total ($)', 'Date'].map(esc).join(','));

    filteredReceipts.forEach((receipt) => {
      const sourceDate = getReceiptDateValue(receipt);
      lines.push(
        [
          receipt.store_name,
          receipt.category || 'Other',
          Number(receipt.total).toFixed(2),
          sourceDate ? formatReceiptDate(sourceDate) : 'N/A',
        ]
          .map(esc)
          .join(','),
      );
    });

    lines.push('');
    lines.push('SUMMARY BY CATEGORY');
    lines.push(['Category', '# of Receipts', 'Total Spent ($)'].map(esc).join(','));

    Object.entries(categorizedReceipts).forEach(([cat, items]) => {
      const catTotal = items.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
      lines.push([cat, items.length, catTotal.toFixed(2)].map(esc).join(','));
    });

    lines.push(['TOTAL', filteredReceipts.length, totalSpend.toFixed(2)].map(esc).join(','));

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ReceiptiFy_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveUsername = async (event) => {
    event.preventDefault();
    if (!user?.id) return;
    const nextUsername = settingsUsername.trim();
    if (!nextUsername) {
      setSettingsMessage('Username cannot be empty.');
      return;
    }

    setSettingsBusy(true);
    setSettingsMessage('');

    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: nextUsername });

    if (error) {
      console.error('Update username error:', error);
      setSettingsMessage('Unable to update username. Ensure profiles table and RLS are configured.');
      setSettingsBusy(false);
      return;
    }

    setSettingsUsernameSaved(nextUsername);
    setSettingsMessage('Username updated successfully.');
    setSettingsBusy(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    if (settingsPassword.length < 8) {
      setSettingsMessage('Password must be at least 8 characters.');
      return;
    }

    setSettingsBusy(true);
    setSettingsMessage('');

    const { error } = await supabase.auth.updateUser({ password: settingsPassword });

    if (error) {
      console.error('Update password error:', error);
      setSettingsMessage(`Unable to update password: ${error.message}`);
      setSettingsBusy(false);
      return;
    }

    setSettingsPassword('');
    setSettingsMessage('Password updated successfully.');
    setSettingsBusy(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthEmail('');
    setAuthPassword('');
    setAuthError('');
    setAuthNotice('');
    setActiveTab('dashboard');
  };

  const currentMonthKey = getCurrentMonthKey();
  const thisMonthKey = currentMonthKey;
  const lastMonthKey = shiftMonthKey(currentMonthKey, -1);
  const last3MonthsStartKey = shiftMonthKey(currentMonthKey, -2);

  const filteredReceipts = receipts.filter((receipt) => {
    const receiptMonthKey = getReceiptMonthKey(receipt);
    const receiptMonthIndex = getMonthIndex(receiptMonthKey);

    if (filterMode === FILTER_MODES.ALL || !receiptMonthKey || receiptMonthIndex === null) {
      return filterMode === FILTER_MODES.ALL;
    }
    if (filterMode === FILTER_MODES.THIS_MONTH) return receiptMonthKey === thisMonthKey;
    if (filterMode === FILTER_MODES.LAST_MONTH) return receiptMonthKey === lastMonthKey;
    if (filterMode === FILTER_MODES.LAST_3_MONTHS) {
      const startIndex = getMonthIndex(last3MonthsStartKey);
      const endIndex = getMonthIndex(thisMonthKey);
      return startIndex !== null && endIndex !== null && receiptMonthIndex >= startIndex && receiptMonthIndex <= endIndex;
    }

    return false;
  });

  const categorizedReceipts = filteredReceipts.reduce((accumulator, receipt) => {
    const category = receipt.category || 'Other';
    if (!accumulator[category]) accumulator[category] = [];
    accumulator[category].push(receipt);
    return accumulator;
  }, {});

  const totalSpend = filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0);
  const topCategory = Object.entries(categorizedReceipts).sort((a, b) => b[1].length - a[1].length)[0]?.[0] || '—';
  const averageSpend = filteredReceipts.length > 0 ? totalSpend / filteredReceipts.length : 0;
  const categorySummary = Object.entries(categorizedReceipts)
    .map(([name, items]) => ({
      name,
      count: items.length,
      total: items.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  const largestCategoryTotal = categorySummary[0]?.total || 0;
  const topSpendShare = totalSpend > 0 && largestCategoryTotal > 0 ? (largestCategoryTotal / totalSpend) * 100 : 0;

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!session || !user) {
    return (
      <AuthGate
        authMode={authMode}
        setAuthMode={setAuthMode}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authBusy={authBusy}
        authError={authError}
        authNotice={authNotice}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-title">{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'upload' ? 'Scan Receipt' : 'Settings'}</div>
          <div className="topbar-actions">
            <div className="user-pill">
              <strong>{settingsUsernameSaved || user.email?.split('@')[0] || 'User'}</strong>
              <span>{user.email}</span>
            </div>
            {activeTab === 'dashboard' && receipts.length > 0 && (
              <button className="topbar-export" onClick={exportToCSV}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            )}
            <button className="topbar-cta" onClick={() => setActiveTab(activeTab === 'upload' ? 'dashboard' : 'upload')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {activeTab === 'upload' ? 'Back to Dashboard' : 'Scan New Receipt'}
            </button>
          </div>
        </header>

        <main className="main-content">
          {activeTab === 'dashboard' && (
            <div className="dashboard-page">
              <section className="date-filter-panel">
                <div className="date-filter-copy">
                  <p className="date-filter-kicker">Receipt date filter</p>
                  <h2>{getQuickFilterLabel(filterMode)}</h2>
                  <p>Use quick filters to review your spending by period, regardless of category.</p>
                </div>
                <div className="date-filter-controls">
                  <div className="filter-presets">
                    <button className={`filter-chip ${filterMode === FILTER_MODES.ALL ? 'active' : ''}`} onClick={() => setFilterMode(FILTER_MODES.ALL)}>
                      All time
                    </button>
                    <button
                      className={`filter-chip ${filterMode === FILTER_MODES.THIS_MONTH ? 'active' : ''}`}
                      onClick={() => setFilterMode(FILTER_MODES.THIS_MONTH)}
                    >
                      This month
                    </button>
                    <button
                      className={`filter-chip ${filterMode === FILTER_MODES.LAST_MONTH ? 'active' : ''}`}
                      onClick={() => setFilterMode(FILTER_MODES.LAST_MONTH)}
                    >
                      Last month
                    </button>
                    <button
                      className={`filter-chip ${filterMode === FILTER_MODES.LAST_3_MONTHS ? 'active' : ''}`}
                      onClick={() => setFilterMode(FILTER_MODES.LAST_3_MONTHS)}
                    >
                      Last 3 months
                    </button>
                  </div>
                </div>
              </section>

              <section className="insight-banner compact">
                <div className="insight-copy">
                  <p className="insight-kicker">Smart Spending Snapshot</p>
                  <h2>Spending rhythm at a glance</h2>
                  <p>
                    {filteredReceipts.length > 0
                      ? `Your top spending category is ${categorySummary[0]?.name || 'Other'} with ${topSpendShare.toFixed(0)}% of all receipts.`
                      : filterMode !== FILTER_MODES.ALL
                        ? 'No receipts were found for this time period. Try another quick filter or switch back to all time.'
                        : 'Upload your first receipt and ReceiptiFy will map your spending patterns automatically.'}
                  </p>
                </div>
                <div className="insight-metrics">
                  <div className="insight-pill">
                    <span>Receipts in view</span>
                    <strong>{filteredReceipts.length}</strong>
                  </div>
                  <div className="insight-pill">
                    <span>Avg. Receipt</span>
                    <strong>${averageSpend.toFixed(2)}</strong>
                  </div>
                  <div className="insight-pill">
                    <span>Total Spend</span>
                    <strong>${totalSpend.toFixed(2)}</strong>
                  </div>
                </div>
              </section>

              <div className="stats-row">
                <StatCard label="Receipts in View" value={filteredReceipts.length} icon="🧾" color="#16a34a" />
                <StatCard label="Money Tracked" value={`$${totalSpend.toFixed(2)}`} icon="💰" color="#3b82f6" />
                <StatCard
                  label="Most Frequent Category"
                  value={topCategory}
                  img={topCategory !== '—' ? getCategoryStyle(topCategory).img : undefined}
                  icon="🏆"
                  color="#f59e0b"
                />
              </div>

              {Object.keys(categorizedReceipts).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧾</div>
                  <h3>{filterMode !== FILTER_MODES.ALL ? 'No receipts found for this time period' : 'No receipts yet'}</h3>
                  <p>
                    {filterMode !== FILTER_MODES.ALL
                      ? 'Try a different quick filter or switch to another period.'
                      : 'Scan your first receipt to start tracking your spending.'}
                  </p>
                  <button className="btn-primary" onClick={() => setActiveTab('upload')}>
                    Scan a Receipt
                  </button>
                </div>
              ) : (
                <div className="categories-grid">
                  {Object.entries(categorizedReceipts).map(([category, items]) => {
                    const style = getCategoryStyle(category);
                    const catTotal = items.reduce((sum, entry) => sum + Number(entry.total || 0), 0);

                    return (
                      <div key={category} className="category-card">
                        <div className="category-header">
                          <div className="cat-icon-wrap" style={{ background: style.bg }}>
                            <img src={style.img} alt={category} className="cat-img" loading="lazy" decoding="async" />
                          </div>
                          <div className="cat-meta">
                            <h3>{category}</h3>
                            <span className="cat-count">
                              {items.length} receipt{items.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <span className="cat-total">${catTotal.toFixed(2)}</span>
                        </div>
                        <ul className="receipt-list">
                          {items.map((item) => (
                            <li key={item.id} className="receipt-item">
                              <div className="receipt-info">
                                <span className="store-name">{item.store_name}</span>
                                <span className="date">{formatReceiptDate(getReceiptDateValue(item))}</span>
                              </div>
                              <div className="receipt-actions">
                                <span className="total">${Number(item.total).toFixed(2)}</span>
                                <button
                                  className="delete-btn"
                                  onClick={() => deleteReceipt(item.id)}
                                  aria-label={`Delete ${item.store_name}`}
                                  title="Delete receipt"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                    <path d="M10 11v6M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  </svg>
                                </button>
                              </div>
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
                    <input
                      ref={inputRef}
                      type="file"
                      className="hidden-input"
                      accept=".jpeg,.jpg,.png,image/jpeg,image/png"
                      onChange={handleChange}
                    />
                    <div className="upload-icon-circle">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <h3>Drop your receipt here</h3>
                    <p>
                      or <span className="upload-link">browse files</span>
                    </p>
                    <span className="file-formats">Supports JPEG, JPG, PNG</span>
                  </div>
                ) : (
                  <div className="preview-container">
                    <div className="image-wrapper">
                      <img src={uploadedImage} alt="Receipt preview" className="preview-image" />
                      <button className="remove-btn" onClick={removeImage} disabled={isProcessing} aria-label="Remove">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      {isProcessing && (
                        <div className="processing-overlay">
                          <div className="spinner" />
                          <p>AI is reading your receipt…</p>
                        </div>
                      )}
                    </div>
                    <div className="action-buttons">
                      <button className="btn-secondary" onClick={removeImage} disabled={isProcessing}>
                        Try Another
                      </button>
                      <button className="btn-primary" onClick={processReceipt} disabled={isProcessing}>
                        {isProcessing ? 'Processing…' : 'Process Receipt'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-page">
              <div className="settings-grid">
                <section className="settings-card">
                  <h3>Profile</h3>
                  <p className="settings-description">Set the username shown in your app interface.</p>
                  <form onSubmit={handleSaveUsername} className="settings-form">
                    <label>
                      Username
                      <input
                        type="text"
                        value={settingsUsername}
                        onChange={(event) => setSettingsUsername(event.target.value)}
                        minLength={2}
                        maxLength={40}
                        required
                      />
                    </label>
                    <button className="btn-primary" type="submit" disabled={settingsBusy}>
                      Save Username
                    </button>
                  </form>
                </section>

                <section className="settings-card">
                  <h3>Theme</h3>
                  <p className="settings-description">Choose between light and dark mode.</p>
                  <div className="theme-switcher">
                    <button
                      type="button"
                      className={`filter-chip ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => setTheme('light')}
                    >
                      Light
                    </button>
                    <button
                      type="button"
                      className={`filter-chip ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => setTheme('dark')}
                    >
                      Dark
                    </button>
                  </div>
                </section>

                <section className="settings-card">
                  <h3>Security</h3>
                  <p className="settings-description">Update your account password.</p>
                  <form onSubmit={handleUpdatePassword} className="settings-form">
                    <label>
                      New Password
                      <input
                        type="password"
                        value={settingsPassword}
                        onChange={(event) => setSettingsPassword(event.target.value)}
                        minLength={8}
                        required
                        autoComplete="new-password"
                      />
                    </label>
                    <button className="btn-primary" type="submit" disabled={settingsBusy}>
                      Update Password
                    </button>
                  </form>
                </section>

                <section className="settings-card danger-zone">
                  <h3>Session</h3>
                  <p className="settings-description">Sign out from this browser session.</p>
                  <button className="btn-secondary" type="button" onClick={handleSignOut}>
                    Sign Out
                  </button>
                </section>
              </div>

              {settingsMessage && <p className="settings-message">{settingsMessage}</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;