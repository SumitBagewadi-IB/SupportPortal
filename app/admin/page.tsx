'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

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

  // Auth effects
  useEffect(() => {
    const stored = sessionStorage.getItem('admin_auth');
    if (stored === 'true') setAuthed(true);
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
    try {
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      setArticles(items);
    } catch { setError('Failed to load articles.'); }
    finally { setLoading(false); }
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
    if (!confirm('Delete this article? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/faq/${id}`, { method: 'DELETE', headers: { 'X-Request-Time': new Date().toISOString(), 'X-Client-Version': '1.0' } });
      if (!res.ok) throw new Error('Failed');
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch { alert('Failed to delete article.'); }
    finally { setDeletingId(null); }
  };

  const handleToggleStatus = async (article: Article) => {
    const isPublished = article.status === 'published' || article.status === 'active';
    const newStatus = isPublished ? 'draft' : 'published';
    setTogglingId(article.id);
    try {
      await fetch(`${API_BASE}/faq`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Time': new Date().toISOString(), 'X-Client-Version': '1.0' }, body: JSON.stringify({ id: article.id, status: newStatus }) });
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: newStatus } : a)));
    } catch { alert('Failed to update status.'); }
    finally { setTogglingId(null); }
  };

  const handleMarkResolved = (ticketId: string) => {
    const updated = tickets.map((t) => t.id === ticketId ? { ...t, status: 'resolved' } : t);
    setTickets(updated);
    localStorage.setItem('is_tickets', JSON.stringify(updated));
    if (previewTicket?.id === ticketId) setPreviewTicket((prev) => prev ? { ...prev, status: 'resolved' } : prev);
  };

  const logout = () => { sessionStorage.removeItem('admin_auth'); setAuthed(false); };

  const filtered = articles.filter((a) => {
    const matchSearch = !search || (a.title || a.question || '').toLowerCase().includes(search.toLowerCase()) || a.category?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || a.category === catFilter;
    return matchSearch && matchCat;
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
        <div style={{ background: 'white', borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Image src="/logo.svg" alt="Indiabulls Securities" width={160} height={36} style={{ height: 36, width: 'auto', margin: '0 auto' }} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1A202C', marginBottom: '0.375rem' }}>Content Admin Portal</h1>
          <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '2rem' }}>Sign in to manage the Knowledge Base content</p>
          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#A0AEC0', fontSize: '0.875rem' }}></span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password"
                disabled={isLocked}
                style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 2.75rem', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A0AEC0', fontSize: '0.875rem' }}>
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
          <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#A0AEC0' }}>Authorized Indiabulls Securities Internal System · Authorized Access Only</p>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* SIDEBAR */}
      <aside style={{ background: '#1A202C', color: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid #2D3748', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Image src="/logo-dark.svg" alt="Indiabulls Securities" width={130} height={22} style={{ height: 22, width: 'auto' }} />
        </div>
        <div style={{ padding: '0.5rem 0.75rem', flex: 1 }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5568', padding: '1.25rem 0.5rem 0.5rem' }}>Content</p>
          {[
            { id: 'articles', label: 'FAQ Articles', icon: '≡' },
            { id: 'add', label: editingId ? 'Edit Article' : 'Add Article', icon: '+' },
            { id: 'tickets', label: 'Support Tickets', icon: '✉' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id as 'articles' | 'add' | 'tickets'); if (item.id !== 'add') { setEditingId(null); setForm(emptyForm); setFormMsg(''); } }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: activeView === item.id ? 'white' : '#A0AEC0', background: activeView === item.id ? '#2D3748' : 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.15s', marginBottom: '0.125rem', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <span style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'tickets' && openTickets > 0 && (
                <span style={{ marginLeft: 'auto', background: '#E53E3E', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 20 }}>{openTickets}</span>
              )}
            </button>
          ))}
          <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5568', padding: '1.25rem 0.5rem 0.5rem' }}>Site</p>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: '#A0AEC0', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none' }}>
            <span style={{ width: 16, textAlign: 'center' }}>o</span> View Site
          </Link>
        </div>
        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid #2D3748' }}>
          <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', borderRadius: 8, color: '#FC8181', background: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, border: 'none', width: '100%', textAlign: 'left' }}>
            <span style={{ width: 16, textAlign: 'center' }}>x</span> Logout
          </button>
          <p style={{ fontSize: '0.65rem', color: '#4A5568', textAlign: 'center', padding: '0.5rem' }}>v1.0 · Admin</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F4F7FE' }}>
        {/* TOPBAR */}
        <div style={{ background: 'white', borderBottom: '1px solid #E2E8F0', padding: '1rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1A202C' }}>
              {activeView === 'articles' && 'FAQ Articles'}
              {activeView === 'add' && (editingId ? 'Edit Article' : 'Add New Article')}
              {activeView === 'tickets' && 'Support Tickets'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#A0AEC0', marginTop: '0.125rem' }}>
              Content Management System · Indiabulls Securities
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#718096' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38A169', display: 'inline-block' }} />
              Admin
            </span>
            {activeView === 'articles' && (
              <button onClick={() => setActiveView('add')} style={{ padding: '0.5rem 1rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                + Add Article
              </button>
            )}
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>

          {/* STATS */}
          {activeView === 'articles' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Total Articles', value: articles.length, icon: 'i', color: '#EFF6FF', iconColor: '#3B82F6' },
                { label: 'Published', value: publishedCount, icon: 'P', color: '#F0FFF4', iconColor: '#38A169' },
                { label: 'Drafts', value: draftCount, icon: 'D', color: '#FFFBEB', iconColor: '#D97706' },
                { label: 'Open Tickets', value: openTickets, icon: 't', color: '#FAF5FF', iconColor: '#7C3AED' },
              ].map((s) => (
                <div key={s.label} style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', flexShrink: 0 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096', marginBottom: '0.25rem' }}>{s.label}</div>
                    <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#1A202C', lineHeight: 1 }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ARTICLES VIEW */}
          {activeView === 'articles' && (
            <>
              {/* Filter bar */}
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search articles..."
                    style={{ width: '100%', padding: '0.5rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <select
                  value={catFilter}
                  onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
                  style={{ padding: '0.5rem 0.75rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'white', color: '#1A202C', cursor: 'pointer' }}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={fetchArticles} style={{ padding: '0.5rem 1rem', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>
                  Refresh
                </button>
              </div>

              {/* Table */}
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1A202C' }}>
                    Articles <span style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 500 }}>({filtered.length} total)</span>
                  </h2>
                </div>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>Loading articles...</div>
                ) : error ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: '#E53E3E', marginBottom: '1rem' }}>{error}</p>
                    <button onClick={fetchArticles} style={{ padding: '0.5rem 1rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Retry</button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>i</div>
                    <p style={{ fontSize: '0.875rem' }}>{search || catFilter ? 'No articles match your filters.' : 'No articles yet. Add your first article!'}</p>
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#FAFAFA' }}>
                          {['#', 'Question / Title', 'Category', 'Status', 'Actions'].map((h) => (
                            <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: '#718096', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((article, i) => {
                          const isPublished = article.status === 'published' || article.status === 'active';
                          const isToggling = togglingId === article.id;
                          const isDeleting = deletingId === article.id;
                          return (
                            <tr key={article.id} style={{ borderBottom: '1px solid #EDF2F7' }}>
                              <td style={{ padding: '0.875rem 1.25rem', color: '#A0AEC0', fontWeight: 600, fontSize: '0.8125rem', width: 48 }}>
                                {(safePage - 1) * PAGE_SIZE + i + 1}
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', maxWidth: 380 }}>
                                <div style={{ fontWeight: 600, color: '#1A202C', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {article.title || article.question || 'Untitled'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#A0AEC0', fontFamily: 'monospace', marginTop: 2 }}>{article.id}</div>
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
                                    <div style={{ position: 'absolute', width: 16, height: 16, background: 'white', borderRadius: '50%', top: 3, left: isPublished ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                  </div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPublished ? '#38A169' : '#E53E3E' }}>
                                    {isToggling ? '...' : isPublished ? 'Published' : 'Draft'}
                                  </span>
                                </button>
                              </td>
                              <td style={{ padding: '0.875rem 1.25rem', width: 100 }}>
                                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                  <button onClick={() => setPreviewArticle(article)} title="Preview" style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>View</button>
                                  <button onClick={() => handleEdit(article)} title="Edit" style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>e</button>
                                  <button onClick={() => handleDelete(article.id)} disabled={isDeleting} title="Delete" style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #FEB2B2', background: 'white', cursor: isDeleting ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', opacity: isDeleting ? 0.5 : 1 }}>Del</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: 8, background: 'white', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Previous</button>
                        <span style={{ fontSize: '0.8125rem', color: '#718096' }}>Page {safePage} of {totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: 8, background: 'white', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Next</button>
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
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#1A202C' }}>{editingId ? 'Edit Article' : 'Add New Article'}</h2>
                  {editingId && (
                    <button onClick={handleCancelEdit} style={{ fontSize: '0.8125rem', color: '#718096', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Cancel Edit</button>
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
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Category *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'white', color: '#1A202C', boxSizing: 'border-box' }}
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
                    <p style={{ fontSize: '0.75rem', color: '#A0AEC0', marginTop: '0.25rem' }}>Write a clear, concise answer. Max 2,000 characters.</p>
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
                    <button type="button" onClick={() => setActiveView('articles')} style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>
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
              <div style={{ background: 'white', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#1A202C' }}>
                    Support Tickets <span style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 500 }}>({tickets.length} total, {openTickets} open)</span>
                  </h2>
                </div>
                {tickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#A0AEC0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>t</div>
                    <p style={{ fontSize: '0.875rem' }}>No support tickets yet</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#FAFAFA' }}>
                        {['Ticket ID', 'Name', 'Email', 'Category', 'Subject', 'Status', 'Date', ''].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: '#718096', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} style={{ borderBottom: '1px solid #EDF2F7' }}>
                          <td style={{ padding: '0.875rem 1.25rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#718096' }}>{ticket.id}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600, color: '#1A202C' }}>{ticket.name}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: '#718096' }}>{ticket.email}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: '#718096' }}>{ticket.category}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: '#1A202C', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <span style={{ display: 'inline-flex', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: ticket.status === 'resolved' ? '#F0FFF4' : '#FFFBEB', color: ticket.status === 'resolved' ? '#276749' : '#744210' }}>
                              {ticket.status || 'open'}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: '#A0AEC0', whiteSpace: 'nowrap' }}>{ticket.date}</td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <button onClick={() => setPreviewTicket(ticket)} style={{ padding: '0.3125rem 0.625rem', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>View</button>
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 540, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 700, color: '#1A202C', fontSize: '1.0625rem', lineHeight: 1.4, paddingRight: '1rem' }}>{previewArticle.title || previewArticle.question || 'Untitled'}</h3>
              <button onClick={() => setPreviewArticle(null)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#A0AEC0', lineHeight: 1 }}>X</button>
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 540, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontWeight: 700, color: '#1A202C', fontSize: '1.0625rem' }}>Ticket Details</h3>
              <button onClick={() => setPreviewTicket(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#A0AEC0' }}>X</button>
            </div>
            <dl style={{ marginBottom: '1.5rem' }}>
              {[['Ticket ID', previewTicket.id], ['Name', previewTicket.name], ['Email', previewTicket.email], ['Phone', previewTicket.phone], ['Category', previewTicket.category], ['Subject', previewTicket.subject], ['Status', previewTicket.status || 'open'], ['Date', previewTicket.date]].map(([label, value]) =>
                value ? (
                  <div key={label} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                    <dt style={{ width: 90, flexShrink: 0, color: '#718096', fontWeight: 600 }}>{label}</dt>
                    <dd style={{ color: '#1A202C' }}>{value}</dd>
                  </div>
                ) : null
              )}
              {previewTicket.message && (
                <div style={{ marginTop: '0.75rem' }}>
                  <dt style={{ fontSize: '0.875rem', color: '#718096', fontWeight: 600, marginBottom: '0.5rem' }}>Message</dt>
                  <dd style={{ background: '#F7FAFC', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem', color: '#1A202C', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewTicket.message}</dd>
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
    </div>
  );
}
