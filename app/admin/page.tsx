'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

// Local fallback articles — mirrors faq/page.tsx FALLBACK_ARTICLES
// Used when the API is unavailable (same pattern as original admin.html reading faq.html)
const LOCAL_ARTICLES: Article[] = [
  { id: 'gs-open-account', title: 'How do I open an account with Indiabulls Securities?', category: 'Getting Started', content: 'You can open an account online at indiabullssecurities.com. The process takes about 10–15 minutes. You will need your PAN card, Aadhaar card, and bank account details. The account is free to open.', status: 'published' },
  { id: 'gs-kyc', title: 'What documents are required for KYC?', category: 'Getting Started', content: 'For KYC you need: PAN card (mandatory), Aadhaar card for address proof, a cancelled cheque or bank statement, and a passport-size photograph. All documents can be uploaded digitally.', status: 'published' },
  { id: 'gs-activate', title: 'How long does account activation take?', category: 'Getting Started', content: 'After completing your KYC, account activation typically takes 1–2 business days. You will receive your Client ID and password via email and SMS.', status: 'published' },
  { id: 'trading-buy-sell', title: 'How do I place a buy or sell order?', category: 'Trading', content: 'Log in to the trading platform, search for the stock, click Buy or Sell, enter the quantity and price, select the order type (Market/Limit/SL), and confirm. Your order will be placed on the exchange.', status: 'published' },
  { id: 'trading-gtt', title: 'What is a GTT order and how do I use it?', category: 'Trading', content: 'GTT (Good Till Triggered) lets you set a target price for a stock. When the stock hits that price, your order is automatically placed. Go to the stock page and click "Set GTT". It remains active for up to 1 year.', status: 'published' },
  { id: 'trading-types', title: 'What order types are available?', category: 'Trading', content: 'Indiabulls offers: Market Order (executes immediately at best price), Limit Order (executes at your specified price or better), Stop-Loss Order (triggers at a specified price to limit losses), and GTT Orders.', status: 'published' },
  { id: 'trading-basket', title: 'How to execute a Basket Order?', category: 'Trading', content: 'Basket orders let you place multiple buy/sell orders simultaneously. Go to Basket Order in the menu, add the stocks and quantities you want, review and submit. All orders are placed at once.', status: 'published' },
  { id: 'funds-add', title: 'How do I add funds to my trading account?', category: 'Funds', content: 'Go to Funds > Add Funds in the app or web platform. You can add funds via UPI (instant), NEFT/RTGS (same day), or Net Banking. Minimum transfer is ₹100. UPI transfers reflect immediately.', status: 'published' },
  { id: 'funds-withdraw', title: 'How do I withdraw funds?', category: 'Funds', content: 'Go to Funds > Withdraw Funds. Enter the amount and confirm. Withdrawals are processed to your registered bank account within 1 working day. There is no charge for withdrawals.', status: 'published' },
  { id: 'funds-timing', title: 'When are funds credited after selling shares?', category: 'Funds', content: 'After selling shares, funds are available in your trading account on T+1 day (next working day) after settlement. You can withdraw these funds after settlement.', status: 'published' },
  { id: 'ipo-apply', title: 'How do I apply for an IPO?', category: 'IPO', content: 'Go to IPO section in the app, select the IPO you want to apply for, enter the number of lots and bid price, and confirm with UPI mandate. Applications close 1 day before IPO closing date.', status: 'published' },
  { id: 'ipo-allotment', title: 'How is IPO allotment decided?', category: 'IPO', content: 'IPO allotment is done by the registrar via a lottery system for retail investors when an IPO is oversubscribed. Results are declared within 6 working days of the issue closing date.', status: 'published' },
  { id: 'ipo-cancel', title: 'Can I cancel my IPO application?', category: 'IPO', content: 'Yes, you can cancel your IPO application before the issue closes. Go to IPO > My Applications and click Cancel. UPI mandate will be released automatically.', status: 'published' },
  { id: 'fo-activate', title: 'How do I activate F&O trading?', category: 'F&O', content: 'To activate F&O, go to My Profile > Segments > Activate F&O. You need to meet minimum net worth criteria and complete an online declaration. Activation takes 1–2 business days.', status: 'published' },
  { id: 'fo-margin', title: 'What is SPAN margin in F&O?', category: 'F&O', content: 'SPAN (Standard Portfolio Analysis of Risk) margin is the minimum margin required to hold F&O positions overnight. It is calculated by the exchange and changes daily based on volatility.', status: 'published' },
  { id: 'fo-expiry', title: 'What happens on F&O expiry day?', category: 'F&O', content: 'On expiry day, all open positions are settled. In-the-money options are exercised automatically. Out-of-the-money options expire worthless. Futures are settled at the final settlement price.', status: 'published' },
  { id: 'charges-brokerage', title: 'What are the brokerage charges?', category: 'Charges & Brokerage', content: 'Equity Delivery: 0% brokerage. Equity Intraday: 0.05% or ₹20 per order (whichever is lower). F&O: ₹20 per order flat. Commodity: ₹20 per order flat. Plus applicable taxes and exchange charges.', status: 'published' },
  { id: 'charges-dp', title: 'What is DP (Depository Participant) charge?', category: 'Charges & Brokerage', content: 'DP charges of ₹13.5 + GST are levied per scrip per day when you sell shares from your demat account. This is charged by CDSL and is the same regardless of quantity sold.', status: 'published' },
  { id: 'account-password', title: 'How do I reset my trading password?', category: 'Account', content: 'Go to the login page and click "Forgot Password". Enter your Client ID or registered email. You will receive a reset link. Passwords must be 8+ characters with letters and numbers.', status: 'published' },
  { id: 'account-nominee', title: 'How do I add or update a nominee?', category: 'Account', content: 'Log in and go to My Profile > Nominee Details. You can add up to 3 nominees with their percentage share. Submit the form with an e-signature via Aadhaar OTP.', status: 'published' },
  { id: 'mtf-what', title: 'What is MTF (Margin Trade Funding)?', category: 'MTF', content: 'MTF lets you buy shares by paying only a fraction of the total value (margin). Indiabulls funds the rest at an interest rate. You can hold MTF positions for up to 365 days.', status: 'published' },
  { id: 'pledging-how', title: 'How do I pledge shares for margin?', category: 'Pledging', content: 'Go to Margin > Pledge Shares. Select the shares you want to pledge, enter quantity, and confirm with OTP. Pledged shares generate collateral margin that can be used for trading. Pledging takes 1 working day.', status: 'published' },
  { id: 'mf-invest', title: 'How do I invest in Mutual Funds?', category: 'Mutual Funds', content: 'Go to the Mutual Funds section, browse or search for a fund, click Invest, choose lump sum or SIP, enter the amount and payment method. Units are allotted at the next applicable NAV.', status: 'published' },
  { id: 'compliance-2fa', title: 'How do I enable two-factor authentication?', category: 'Compliance & Safety', content: 'Go to My Profile > Security Settings > Two-Factor Authentication. Enable TOTP via an authenticator app (Google Authenticator or Authy) or SMS OTP. 2FA adds an extra layer of security to your account.', status: 'published' },
  { id: 'reports-pl', title: 'Where can I view my P&L report?', category: 'Reports', content: 'Go to Reports > P&L Statement. You can view realized and unrealized P&L, filter by date range, and download as CSV or PDF. The report is available for the current and past 3 financial years.', status: 'published' },
  { id: 'kyc-update', title: 'How do I update my KYC details?', category: 'KYC', content: 'Go to My Profile > KYC Details. You can update your address, bank account, or contact details. Changes require document upload and may take 2–3 working days to reflect.', status: 'published' },
  { id: 'contact-escalate', title: 'How do I escalate a complaint?', category: 'Contact & Escalation', content: 'If your issue is not resolved within 7 days, you can escalate to our grievance officer at grievance@indiabullssecurities.com or file a complaint on SEBI SCORES at scores.sebi.gov.in.', status: 'published' },
  { id: 'nri-account', title: 'Can NRIs open a trading account?', category: 'NRI/HUF Accounts', content: 'Yes, NRIs can open NRE/NRO demat and trading accounts with Indiabulls Securities. PIS (Portfolio Investment Scheme) permission from RBI is required for NRE accounts. Contact our NRI desk for assistance.', status: 'published' },
  { id: 'tender-offer', title: 'How do I participate in a Tender Offer / Buyback?', category: 'Tender Offers', content: 'When a company announces a buyback via tender offer, go to the Corporate Actions section in your account. Select the buyback offer, enter the number of shares to tender, and confirm before the last date.', status: 'published' },
];

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;
const PAGE_SIZE = 10;
const MAX_CONTENT = 2000;
const WARN_CONTENT = 1800;

const CATEGORIES = [
  'Getting Started', 'Account Opening', 'Trading', 'Portfolio & Margin',
  'Funds', 'Charges & Brokerage', 'Compliance & Safety', 'Mutual Funds',
  'IPO', 'F&O', 'Pledging', 'MTF', 'Tender Offers', 'Contact & Help',
  'Advanced', 'Account', 'Reports', 'NRI/HUF Accounts',
];

interface Article {
  id: string;
  title: string;
  question?: string;
  category: string;
  content: string;
  answer?: string;
  status?: string;
}

interface Ticket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: string;
  date: string;
  message?: string;
  phone?: string;
}

const emptyForm = { title: '', category: '', content: '', status: 'published' };

export default function AdminPage() {
  // Auth
  const [authed, setAuthed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Articles
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);

  // Sidebar view
  const [activeView, setActiveView] = useState<'articles' | 'add' | 'tickets'>('articles');

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Dark mode
  const [darkMode, setDarkMode] = useState(false);
  // Status filter
  const [statusFilter, setStatusFilter] = useState('');
  // Sort
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'category'>('default');
  // Delete confirm modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auth effects
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_auth');
    if (stored === 'true') setAuthed(true);
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') setDarkMode(true);
  }, []);

  useEffect(() => {
    if (lockoutUntil) {
      const tick = () => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setLockoutSecsLeft(0);
          if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
        } else {
          setLockoutSecsLeft(remaining);
        }
      };
      tick();
      lockoutTimerRef.current = setInterval(tick, 1000);
      return () => { if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current); };
    }
  }, [lockoutUntil]);

  useEffect(() => {
    if (authed) {
      try {
        const raw = localStorage.getItem('is_tickets');
        if (raw) setTickets(JSON.parse(raw) as Ticket[]);
      } catch { setTickets([]); }
    }
  }, [authed]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      setAuthed(true);
      setAttempts(0);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_SECONDS * 1000;
        setLockoutUntil(until);
        setAuthError(`Too many failed attempts. Login disabled for ${LOCKOUT_SECONDS}s.`);
      } else {
        setAuthError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
      }
    }
  };

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    // Always load local articles first (mirrors original admin.html reading faq.html)
    setArticles(LOCAL_ARTICLES);
    // Then try to sync from API — silently merge if available, silently skip if not
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/faq`);
        if (res.ok) {
          const data = await res.json();
          const apiItems: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
          if (apiItems.length > 0) {
            // Merge: API articles take precedence, local fills any gaps
            const apiIds = new Set(apiItems.map((a) => a.id));
            const merged = [...apiItems, ...LOCAL_ARTICLES.filter((a) => !apiIds.has(a.id))];
            setArticles(merged);
          }
        }
      } catch { /* silently ignore — local articles are already shown */ }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) fetchArticles(); }, [authed, fetchArticles]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.content) { setFormMsg('All fields are required.'); return; }
    if (form.content.length > MAX_CONTENT) { setFormMsg('Content exceeds 2000 characters.'); return; }
    setSubmitting(true);
    setFormMsg('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...form, id: editingId } : form;
      const res = await fetch(`${API_BASE}/faq`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Request-Time': new Date().toISOString(), 'X-Client-Version': '1.0' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      setFormMsg(editingId ? 'Article updated successfully!' : 'Article added successfully!');
      setForm(emptyForm);
      setEditingId(null);
      fetchArticles();
      setTimeout(() => { setActiveView('articles'); setFormMsg(''); }, 1200);
    } catch { setFormMsg(editingId ? 'Failed to update article.' : 'Failed to add article.'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = (article: Article) => {
    setForm({ title: article.title || article.question || '', category: article.category || '', content: article.content || article.answer || '', status: article.status || 'published' });
    setEditingId(article.id);
    setFormMsg('');
    setActiveView('add');
  };

  const handleCancelEdit = () => { setForm(emptyForm); setEditingId(null); setFormMsg(''); setActiveView('articles'); };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/faq/${id}`, { method: 'DELETE', headers: { 'X-Request-Time': new Date().toISOString(), 'X-Client-Version': '1.0' } });
      if (!res.ok) throw new Error('Failed');
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch { setError('Failed to delete article. Please try again.'); }
    finally { setDeletingId(null); }
  };

  const handleToggleStatus = async (article: Article) => {
    const isPublished = article.status === 'published' || article.status === 'active';
    const newStatus = isPublished ? 'draft' : 'published';
    setTogglingId(article.id);
    try {
      await fetch(`${API_BASE}/faq`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Time': new Date().toISOString(), 'X-Client-Version': '1.0' }, body: JSON.stringify({ id: article.id, status: newStatus }) });
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: newStatus } : a)));
    } catch { setError('Failed to update status. Please try again.'); }
    finally { setTogglingId(null); }
  };

  const handleMarkResolved = (ticketId: string) => {
    const updated = tickets.map((t) => t.id === ticketId ? { ...t, status: 'resolved' } : t);
    setTickets(updated);
    localStorage.setItem('is_tickets', JSON.stringify(updated));
    if (previewTicket?.id === ticketId) setPreviewTicket((prev) => prev ? { ...prev, status: 'resolved' } : prev);
  };

  const logout = () => { sessionStorage.removeItem('admin_auth'); setAuthed(false); };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const filtered = articles.filter((a) => {
    const matchSearch = !search || (a.title || a.question || '').toLowerCase().includes(search.toLowerCase()) || a.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || a.category === catFilter;
    const matchStatus = !statusFilter || (statusFilter === 'published' ? (a.status === 'published' || a.status === 'active') : a.status === 'draft');
    return matchSearch && matchCat && matchStatus;
  }).sort((a, b) => {
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const contentLen = form.content.length;

  const publishedCount = articles.filter((a) => a.status === 'published' || a.status === 'active').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;
  const openTickets = tickets.filter((t) => t.status !== 'resolved').length;

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!authed) {
    const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0F172A 0%, #1A202C 50%, #2D3748 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: 'var(--admin-modal-bg)', borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Image src="/logo.svg" alt="Indiabulls Securities" width={160} height={36} style={{ height: 36, width: 'auto', margin: '0 auto' }} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: '0.375rem' }}>Content Admin Portal</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)', marginBottom: '2rem' }}>Sign in to manage the Knowledge Base content</p>
          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}></span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                disabled={isLocked}
                style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 2.75rem', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {authError && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', color: '#C53030', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem', marginBottom: '0.75rem', textAlign: 'left' }}>
                Warning: {authError}
              </div>
            )}
            {isLocked && (
              <p style={{ color: '#DD6B20', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Login disabled. Try again in {lockoutSecsLeft}s.</p>
            )}
            <button type="submit" disabled={isLocked} style={{ width: '100%', padding: '0.875rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1 }}>
              Sign In
            </button>
          </form>
          <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Authorized Indiabulls Securities Internal System · Authorized Access Only</p>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div className="admin-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: 'relative' }}>

      {/* MOBILE OVERLAY */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`admin-sidebar-overlay${sidebarOpen ? ' active' : ''}`}
      />

      {/* SIDEBAR */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #2D3748', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
          <Image src="/logo-dark.svg" alt="Indiabulls Securities" width={130} height={22} style={{ height: 22, width: 'auto', minWidth: 0, flexShrink: 1 }} />
          <button onClick={() => setSidebarOpen(false)} className="admin-sidebar-close" style={{ background: 'none', border: 'none', color: '#A0AEC0', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div style={{ padding: '0.5rem 0.75rem', flex: 1 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5568', padding: '1.25rem 0.5rem 0.5rem' }}>Content</p>
          {[
            { id: 'articles', label: 'FAQ Articles', icon: 'fa-list' },
            { id: 'add', label: editingId ? 'Edit Article' : 'Add Article', icon: 'fa-plus' },
            { id: 'tickets', label: 'Support Tickets', icon: 'fa-envelope' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id as 'articles' | 'add' | 'tickets'); if (item.id !== 'add') { setEditingId(null); setForm(emptyForm); setFormMsg(''); } }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: activeView === item.id ? 'white' : '#A0AEC0', background: activeView === item.id ? '#2D3748' : 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.15s', marginBottom: '0.125rem', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <i className={`fas ${item.icon}`} style={{ width: 16, textAlign: 'center' }}></i>
              {item.label}
              {item.id === 'tickets' && openTickets > 0 && (
                <span style={{ marginLeft: 'auto', background: '#E53E3E', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 20 }}>{openTickets}</span>
              )}
            </button>
          ))}
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5568', padding: '1.25rem 0.5rem 0.5rem' }}>Site</p>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: 'var(--admin-text-muted)', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
            <i className="fas fa-arrow-up-right-from-square" style={{ width: 16, textAlign: 'center', fontSize: '0.75rem' }}></i> View Site
          </Link>
        </div>
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid #2D3748' }}>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: '#FC8181', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, border: 'none', width: '100%', textAlign: 'left' }}>
            <i className="fas fa-right-from-bracket" style={{ width: 16, textAlign: 'center' }}></i> Logout
          </button>
          <p style={{ fontSize: '0.65rem', color: '#4A5568', textAlign: 'center', padding: '0.5rem' }}>v1.0 · Admin</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--admin-bg)', flex: 1, minWidth: 0 }}>
        {/* TOPBAR */}
        <div style={{ background: 'var(--admin-topbar)', borderBottom: '1px solid var(--admin-border)', padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="admin-hamburger"
              aria-label="Open menu"
              style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.875rem', flexShrink: 0 }}
            >
              <i className="fas fa-bars"></i>
            </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--admin-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeView === 'articles' && 'FAQ Articles'}
              {activeView === 'add' && (editingId ? 'Edit Article' : 'Add New Article')}
              {activeView === 'tickets' && 'Support Tickets'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', marginTop: '0.125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Content Management System · Indiabulls Securities
            </div>
          </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={toggleDarkMode}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.875rem' }}
            >
              <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38A169', display: 'inline-block', flexShrink: 0 }} />
              Admin
            </span>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>

          {/* STATS */}
          {activeView === 'articles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Articles', value: articles.length, icon: 'fa-file-lines', color: '#EFF6FF', iconColor: '#3B82F6' },
                { label: 'Published', value: publishedCount, icon: 'fa-circle-check', color: '#F0FFF4', iconColor: '#38A169' },
                { label: 'Drafts', value: draftCount, icon: 'fa-file-pen', color: '#FFFBEB', iconColor: '#D97706' },
                { label: 'Open Tickets', value: openTickets, icon: 'fa-ticket', color: '#FAF5FF', iconColor: '#7C3AED' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0, color: s.iconColor }}><i className={`fas ${s.icon}`}></i></div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--admin-text-secondary)', marginBottom: '0.25rem' }}>{s.label}</div>
                    <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--admin-text-primary)', lineHeight: 1 }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ARTICLES VIEW */}
          {activeView === 'articles' && (
            <>
              {/* Filter bar */}
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
                  <i className="fas fa-search" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)', fontSize: '0.75rem', pointerEvents: 'none' }}></i>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search articles..."
                    style={{ width: '100%', padding: '0.5rem 0.875rem 0.5rem 2rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)' }}
                  />
                </div>
                <select
                  value={catFilter}
                  onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
                  style={{ padding: '0.5rem 0.75rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--admin-surface)', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  style={{ padding: '0.5rem 0.75rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--admin-surface)', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
                >
                  <option value="">All Status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'title' | 'category')}
                  style={{ padding: '0.5rem 0.75rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--admin-surface)', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
                >
                  <option value="default">Default Order</option>
                  <option value="title">Sort: Title A–Z</option>
                  <option value="category">Sort: Category</option>
                </select>
                <button onClick={fetchArticles} title="Refresh" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', cursor: 'pointer', color: 'var(--admin-text-secondary)', flexShrink: 0 }}>
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>

              {/* Table */}
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>
                    Articles <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>({filtered.length} total)</span>
                  </h2>
                </div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>Loading articles...</div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#E53E3E', marginBottom: '1rem' }}>{error}</p>
                    <button onClick={fetchArticles} style={{ padding: '0.5rem 1rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Retry</button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--admin-text-muted)' }}><i className="fas fa-file-lines"></i></div>
                    <p style={{ fontSize: '0.875rem' }}>{search || catFilter ? 'No articles match your filters.' : 'No articles yet. Add your first article!'}</p>
                  </div>
                ) : (
                  <>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                      <thead>
                        <tr style={{ background: 'var(--admin-row-hover)' }}>
                          {['#', 'Question / Title', 'Category', 'Status', 'Actions'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((article, i) => {
                          const isPublished = article.status === 'published' || article.status === 'active';
                          const isToggling = togglingId === article.id;
                          const isDeleting = deletingId === article.id;
                          return (
                            <tr key={article.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                              <td style={{ padding: '0.875rem 1.25rem', color: 'var(--admin-text-muted)', fontWeight: 600, fontSize: '0.8125rem', width: 48 }}>
                                {(safePage - 1) * PAGE_SIZE + i + 1}
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', maxWidth: 380 }}>
                                <div style={{ fontWeight: 600, color: 'var(--admin-text-primary)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {article.title || article.question || 'Untitled'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{article.id}</div>
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', width: 160 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', background: '#EFF6FF', color: '#3B82F6', whiteSpace: 'nowrap' }}>
                                  {article.category}
                                </span>
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', width: 140 }}>
                                <button
                                  onClick={() => handleToggleStatus(article)}
                                  disabled={isToggling}
                                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: isToggling ? 'wait' : 'pointer', padding: 0 }}
                                >
                                  <div style={{ position: 'relative', width: 40, height: 22 }}>
                                    <div style={{ position: 'absolute', inset: 0, background: isPublished ? '#38A169' : '#CBD5E0', borderRadius: 22, transition: 'background 0.2s' }} />
                                    <div style={{ position: 'absolute', width: 16, height: 16, background: 'var(--admin-surface)', borderRadius: '50%', top: 3, left: isPublished ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPublished ? '#38A169' : '#E53E3E' }}>
                                    {isToggling ? '...' : isPublished ? 'Published' : 'Draft'}
                                  </span>
                                </button>
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', width: 100 }}>
                                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                  <button onClick={() => setPreviewArticle(article)} title="Preview" style={{ width: 34, height: 34, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-secondary)' }}>
                                    <i className="fas fa-eye" style={{ fontSize: '0.8rem' }}></i>
                                  </button>
                                  <button onClick={() => handleEdit(article)} title="Edit" style={{ width: 34, height: 34, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                                    <i className="fas fa-pen" style={{ fontSize: '0.8rem' }}></i>
                                  </button>
                                  <button onClick={() => handleDelete(article.id)} disabled={isDeleting} title="Delete" style={{ width: 34, height: 34, borderRadius: 6, border: '1.5px solid #FEB2B2', background: 'var(--admin-surface)', cursor: isDeleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53E3E', opacity: isDeleting ? 0.5 : 1 }}>
                                    <i className="fas fa-trash" style={{ fontSize: '0.8rem' }}></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, background: 'var(--admin-surface)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Previous</button>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>Page {safePage} of {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, background: 'var(--admin-surface)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Next</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* ADD / EDIT ARTICLE VIEW */}
          {activeView === 'add' && (
            <div style={{ maxWidth: 720 }}>
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>{editingId ? 'Edit Article' : 'Add New Article'}</h2>
                  {editingId && (
                    <button onClick={handleCancelEdit} style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancel Edit</button>
                  )}
                </div>
                <form onSubmit={handleSubmitForm}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Title / Question *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. How to place a GTT order?"
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--admin-surface)', color: 'var(--admin-text-primary)', boxSizing: 'border-box' }}
                    >
                      <option value="">Select a category...</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Content / Answer *</label>
                      <span style={{ fontSize: '0.75rem', color: contentLen > MAX_CONTENT ? '#E53E3E' : contentLen > WARN_CONTENT ? '#DD6B20' : '#A0AEC0', fontWeight: contentLen > WARN_CONTENT ? 600 : 400 }}>
                        {contentLen} / {MAX_CONTENT}
                      </span>
                    </div>
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="Write the answer or article content here..."
                      rows={8}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: `1.5px solid ${contentLen > MAX_CONTENT ? '#FC8181' : contentLen > WARN_CONTENT ? '#F6AD55' : '#E2E8F0'}`, borderRadius: 8, fontSize: '0.875rem', outline: 'none', resize: 'vertical', minHeight: 120, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>Write a clear, concise answer. Max 2,000 characters.</p>
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Status</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      {['published', 'draft'].map((s) => (
                        <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                          <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => setForm({ ...form, status: s })} />
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  {formMsg && (
                    <div style={{ padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem', marginBottom: '1rem', background: formMsg.includes('success') ? '#F0FFF4' : '#FFF5F5', border: `1px solid ${formMsg.includes('success') ? '#9AE6B4' : '#FEB2B2'}`, color: formMsg.includes('success') ? '#276749' : '#C53030', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {formMsg}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #EDF2F7' }}>
                    <button type="submit" disabled={submitting || contentLen > MAX_CONTENT} style={{ padding: '0.75rem 1.5rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, cursor: submitting || contentLen > MAX_CONTENT ? 'not-allowed' : 'pointer', opacity: submitting || contentLen > MAX_CONTENT ? 0.6 : 1 }}>
                      {submitting ? (editingId ? 'Updating...' : 'Adding...') : (editingId ? 'Update Article' : 'Add Article')}
                    </button>
                    <button type="button" onClick={() => setActiveView('articles')} style={{ padding: '0.75rem 1.5rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TICKETS VIEW */}
          {activeView === 'tickets' && (
            <div>
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>
                    Support Tickets <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>({tickets.length} total, {openTickets} open)</span>
                  </h2>
                </div>
                {tickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--admin-text-muted)' }}><i className="fas fa-ticket"></i></div>
                    <p style={{ fontSize: '0.875rem' }}>No support tickets yet</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--admin-row-hover)' }}>
                        {['Ticket ID', 'Name', 'Email', 'Category', 'Subject', 'Status', 'Date', ''].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                          <td style={{ padding: '0.875rem 1.25rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{ticket.id}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-primary)' }}>{ticket.name}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{ticket.email}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{ticket.category}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <span style={{ display: 'inline-flex', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: ticket.status === 'resolved' ? '#F0FFF4' : '#FFFBEB', color: ticket.status === 'resolved' ? '#276749' : '#744210' }}>
                              {ticket.status || 'open'}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>{ticket.date}</td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <button onClick={() => setPreviewTicket(ticket)} style={{ padding: '0.3125rem 0.625rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ARTICLE PREVIEW MODAL */}
      {previewArticle && (
        <div onClick={() => setPreviewArticle(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--admin-surface)', borderRadius: 16, border: '1px solid var(--admin-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 540, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--admin-text-primary)', fontSize: '1.0625rem', lineHeight: 1.4, paddingRight: '1rem' }}>{previewArticle.title || previewArticle.question || 'Untitled'}</h3>
              <button onClick={() => setPreviewArticle(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--admin-text-muted)', lineHeight: 1 }}>X</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: '#EFF6FF', color: '#3B82F6' }}>{previewArticle.category}</span>
              {previewArticle.status && <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: '#F0FFF4', color: '#276749' }}>{previewArticle.status}</span>}
            </div>
            <p style={{ fontSize: '0.875rem', color: '#4A5568', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewArticle.content || previewArticle.answer || ''}</p>
          </div>
        </div>
      )}

      {/* TICKET DETAIL MODAL */}
      {previewTicket && (
        <div onClick={() => setPreviewTicket(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--admin-surface)', borderRadius: 16, border: '1px solid var(--admin-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 540, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--admin-text-primary)', fontSize: '1.0625rem' }}>Ticket Details</h3>
              <button onClick={() => setPreviewTicket(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--admin-text-muted)' }}>X</button>
            </div>
            <dl style={{ marginBottom: '1.5rem' }}>
              {[['Ticket ID', previewTicket.id], ['Name', previewTicket.name], ['Email', previewTicket.email], ['Phone', previewTicket.phone], ['Category', previewTicket.category], ['Subject', previewTicket.subject], ['Status', previewTicket.status || 'open'], ['Date', previewTicket.date]].map(([label, value]) =>
                value ? (
                  <div key={label} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                    <dt style={{ width: 90, flexShrink: 0, color: 'var(--admin-text-secondary)', fontWeight: 600 }}>{label}</dt>
                    <dd style={{ color: 'var(--admin-text-primary)' }}>{value}</dd>
                  </div>
                ) : null
              )}
              {previewTicket.message && (
                <div style={{ marginTop: '0.75rem' }}>
                  <dt style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Message</dt>
                  <dd style={{ background: '#F7FAFC', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem', color: 'var(--admin-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewTicket.message}</dd>
                </div>
              )}
            </dl>
            {previewTicket.status !== 'resolved' ? (
              <button onClick={() => handleMarkResolved(previewTicket.id)} style={{ width: '100%', padding: '0.875rem', background: '#38A169', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}>
                Mark as Resolved
              </button>
            ) : (
              <p style={{ textAlign: 'center', color: '#38A169', fontWeight: 600, fontSize: '0.875rem' }}>This ticket has been resolved.</p>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--admin-modal-bg)', borderRadius: 16, border: '1px solid var(--admin-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.2)', maxWidth: 400, width: '100%', padding: '2rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.25rem', color: '#E53E3E' }}>
              <i className="fas fa-trash"></i>
            </div>
            <h3 style={{ textAlign: 'center', fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: '0.5rem', fontSize: '1.0625rem' }}>Delete Article?</h3>
            <p style={{ textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              This action cannot be undone. The article will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{ flex: 1, padding: '0.75rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', color: 'var(--admin-text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{ flex: 1, padding: '0.75rem', background: '#E53E3E', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
