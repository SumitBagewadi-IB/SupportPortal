'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900; // 15 minutes — matches server-side lockout
const PAGE_SIZE = 10;
const MAX_CONTENT = 50000;
const WARN_CONTENT = 45000;
const TICKETS_PAGE_SIZE = 10;

const FALLBACK_CATEGORIES = [
  'Getting Started', 'Account Opening', 'Trading', 'Portfolio & Margin',
  'Funds', 'Charges & Brokerage', 'Compliance & Safety', 'Mutual Funds',
  'IPO', 'F&O', 'Pledging', 'MTF', 'Tender Offers', 'Contact & Help',
  'Advanced', 'Account', 'Reports', 'NRI/HUF Accounts', 'Other',
];

interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  sortOrder?: number;
  status?: string;
}

interface Article {
  id: string;
  title: string;
  question?: string;
  category: string;
  content: string;
  answer?: string;
  status?: string;
  sortOrder?: number;
}

interface Ticket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: string;
  date: string;
  description?: string;
  message?: string;
  phone?: string;
}

const emptyForm = { title: '', category: '', content: '', status: 'published' };

export default function AdminPage() {
  // Auth — lazy-init from sessionStorage to avoid login flash on hard refresh
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [managerToken, setManagerToken] = useState('');
  const [managerInfo, setManagerInfo] = useState<{ managerId: string; displayName: string; role: string } | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const sessionWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lockoutSecsLeft, setLockoutSecsLeft] = useState(0);
  const lockoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Articles
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
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
  const [activeView, setActiveView] = useState<'articles' | 'add' | 'tickets' | 'audit' | 'categories'>('articles');

  // Categories
  const [dynamicCategories, setDynamicCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');
  const [catForm, setCatForm] = useState({ name: '', icon: 'fas fa-folder', parentId: '' });
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormMsg, setCatFormMsg] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  // Audit log
  const [auditLogs, setAuditLogs] = useState<{ id: string; timestamp: string; action: string; entity: string; entityId: string; entityTitle: string; performedBy: string; meta?: Record<string, string> }[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState('');

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Dark mode
  const [darkMode, setDarkMode] = useState(false);
  // Status filter
  const [statusFilter, setStatusFilter] = useState('');
  // Sort
  const [sortBy, setSortBy] = useState<'default' | 'title' | 'category'>('default');
  const [orderChanged, setOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [reorderCategory, setReorderCategory] = useState<string>('');
  // Delete confirm modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  // Toast notification
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ticket search + pagination
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketPage, setTicketPage] = useState(1);

  // Auth effects — restore JWT session synchronously before first paint
  useEffect(() => {
    const token = sessionStorage.getItem('mgr_token');
    const info = sessionStorage.getItem('mgr_info');
    if (token && info) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
          setManagerToken(token);
          setManagerInfo(JSON.parse(info));
          setSessionExpiresAt(payload.exp);
          setAuthed(true);
        } else {
          sessionStorage.removeItem('mgr_token');
          sessionStorage.removeItem('mgr_info');
        }
      } catch { /* stale token */ }
    }
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') setDarkMode(true);
    setAuthChecked(true);
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

  // Session expiry warning — show banner 5 minutes before token expires
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const msUntilWarning = (sessionExpiresAt * 1000) - Date.now() - 5 * 60 * 1000;
    if (msUntilWarning <= 0) { setSessionWarning(true); return; }
    sessionWarningTimerRef.current = setTimeout(() => setSessionWarning(true), msUntilWarning);
    return () => { if (sessionWarningTimerRef.current) clearTimeout(sessionWarningTimerRef.current); };
  }, [sessionExpiresAt]);

  const authHeaders = useCallback((token: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), []);

  const fetchTickets = useCallback((token: string) => {
    if (!API_BASE) return;
    setTicketsLoading(true);
    setTicketsError('');
    fetch(`${API_BASE}/tickets`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(() => setTicketsError('Could not load tickets. Check your connection or API config.'))
      .finally(() => setTicketsLoading(false));
  }, []);

  const handleSessionExpired = useCallback(() => {
    setManagerToken('');
    setAuthed(false);
    setSessionWarning(false);
    setSessionExpiresAt(null);
    sessionStorage.removeItem('mgr_token');
    sessionStorage.removeItem('mgr_info');
    setAuthError('Your session has expired. Please log in again.');
  }, []);

  const fetchAuditLogs = useCallback((token: string) => {
    if (!API_BASE) return;
    setAuditLoading(true);
    fetch(`${API_BASE}/audit-log`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { handleSessionExpired(); return []; }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => { if (data) setAuditLogs(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setAuditLoading(false));
  }, [handleSessionExpired]);

  const fetchCategories = useCallback(async () => {
    if (!API_BASE) return;
    setCatLoading(true);
    setCatError('');
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) setDynamicCategories(await res.json());
      else setCatError('Failed to load categories.');
    } catch { setCatError('Could not reach API.'); }
    finally { setCatLoading(false); }
  }, []);

  useEffect(() => {
    if (authed && managerToken) {
      fetchTickets(managerToken);
      fetchAuditLogs(managerToken);
      fetchCategories();
    }
  }, [authed, managerToken, fetchTickets, fetchAuditLogs, fetchCategories]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutUntil && Date.now() < lockoutUntil) return;
    if (!usernameInput || !passwordInput) { setAuthError('Enter your username and password.'); return; }
    setLoginLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('mgr_token', data.token);
        sessionStorage.setItem('mgr_info', JSON.stringify({ managerId: data.managerId, displayName: data.displayName, role: data.role }));
        setManagerToken(data.token);
        setManagerInfo({ managerId: data.managerId, displayName: data.displayName, role: data.role });
        try {
          const p = JSON.parse(atob(data.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (p.exp) setSessionExpiresAt(p.exp);
        } catch { /* ignore */ }
        setAuthed(true);
        setAttempts(0);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockoutUntil(until);
          setAuthError(`Too many failed attempts. Login disabled for 15 minutes.`);
        } else {
          setAuthError(`Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt(s) remaining.`);
        }
      }
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setLoginLoading(false);
      setPasswordInput('');
    }
  };

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/faq`);
        if (res.status === 401) { handleSessionExpired(); return; }
        if (res.ok) {
          const data = await res.json();
          const apiItems: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
          setArticles(apiItems);
        } else {
          setError('Failed to load articles from API.');
          setArticles([]);
        }
      } catch {
        setError('Could not reach the API. Check your connection.');
        setArticles([]);
      }
    } else {
      setError('API not configured.');
      setArticles([]);
    }
    setLoading(false);
    setLastRefreshed(new Date());
  }, [handleSessionExpired]);

  useEffect(() => { if (authed) fetchArticles(); }, [authed, fetchArticles]);

  const moveArticle = (globalIndex: number, direction: 'up' | 'down', category?: string) => {
    const next = [...articles];
    if (category) {
      // Find the adjacent article in the same category
      const peers = next
        .map((a, gi) => ({ gi, cat: a.category }))
        .filter((x) => x.cat === category);
      const peerPos = peers.findIndex((x) => x.gi === globalIndex);
      const adjacentPeer = direction === 'up' ? peers[peerPos - 1] : peers[peerPos + 1];
      if (!adjacentPeer) return;
      [next[globalIndex], next[adjacentPeer.gi]] = [next[adjacentPeer.gi], next[globalIndex]];
    } else {
      const swapIndex = direction === 'up' ? globalIndex - 1 : globalIndex + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return;
      [next[globalIndex], next[swapIndex]] = [next[swapIndex], next[globalIndex]];
    }
    setArticles(next);
    setOrderChanged(true);
    setSortBy('default');
    if (category) setReorderCategory(category);
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 3500);
  }, []);

  const saveOrder = useCallback(async () => {
    if (!API_BASE || !managerToken) return;
    setSavingOrder(true);
    try {
      const toUpdate = reorderCategory
        ? articles.filter(a => a.category === reorderCategory)
        : articles;
      const results = await Promise.all(toUpdate.map((a, i) =>
        fetch(`${API_BASE}/faq/${a.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${managerToken}` },
          body: JSON.stringify({ sortOrder: i }),
        })
      ));
      const unauthorized = results.find(r => r.status === 401);
      if (unauthorized) { handleSessionExpired(); return; }
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) {
        showToast(`Failed to save order (${failed.length} errors). Please try again.`);
      } else {
        setOrderChanged(false);
        setReorderCategory('');
        showToast('Order saved!');
      }
    } catch {
      showToast('Network error. Failed to save order.');
    }
    setSavingOrder(false);
  }, [articles, managerToken, reorderCategory, showToast]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.content) { setFormMsg('All fields are required.'); return; }
    if (form.content.length > MAX_CONTENT) { setFormMsg(`Content exceeds ${MAX_CONTENT.toLocaleString()} characters.`); return; }
    const isDuplicate = articles.some(a => a.title.trim().toLowerCase() === form.title.trim().toLowerCase() && a.id !== editingId);
    if (isDuplicate) { setFormMsg('An article with this title already exists.'); return; }
    setSubmitting(true);
    setFormMsg('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `${API_BASE}/faq/${editingId}` : `${API_BASE}/faq`;
      // Assign new articles the next sortOrder so they don't default to last
      const catPeers = articles.filter(a => a.category === form.category);
      const nextSortOrder = catPeers.length > 0 ? Math.max(...catPeers.map(a => a.sortOrder ?? 0)) + 1 : 0;
      const body = editingId ? { ...form } : { ...form, sortOrder: nextSortOrder };
      const res = await fetch(url, {
        method,
        headers: authHeaders(managerToken),
        body: JSON.stringify(body),
      });
      if (res.status === 401) { handleSessionExpired(); return; }
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
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/faq/${id}`, { method: 'DELETE', headers: authHeaders(managerToken) });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) throw new Error('Failed');
      setArticles((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
      showToast('Article deleted successfully.');
    } catch { showToast('Failed to delete article. Please try again.'); }
    finally { setDeletingId(null); }
  };

  const handleToggleStatus = async (article: Article) => {
    const isPublished = article.status === 'published' || article.status === 'active';
    const newStatus = isPublished ? 'draft' : 'published';
    setTogglingId(article.id);
    // Optimistic update
    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: newStatus } : a)));
    try {
      const res = await fetch(`${API_BASE}/faq/${article.id}`, { method: 'PUT', headers: authHeaders(managerToken), body: JSON.stringify({ status: newStatus }) });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Roll back optimistic update
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: article.status } : a)));
      setError('Failed to update status. Please try again.');
    }
    finally { setTogglingId(null); }
  };

  const handleMarkResolved = async (ticketId: string) => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    // Use 'solved' to match the system-wide ticket status schema (open → in_progress → solved)
    const updated = { ...ticket, status: 'solved' };
    setTickets((prev) => prev.map((t) => t.id === ticketId ? updated : t));
    if (previewTicket?.id === ticketId) setPreviewTicket(updated);
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
          method: 'PUT',
          headers: authHeaders(managerToken),
          body: JSON.stringify({ status: 'solved' }),
        });
        if (res.status === 401) { handleSessionExpired(); return; }
        if (!res.ok) throw new Error('Failed');
      } catch {
        // Roll back optimistic update on failure
        setTickets((prev) => prev.map((t) => t.id === ticketId ? ticket : t));
        if (previewTicket?.id === ticketId) setPreviewTicket(ticket);
        setError('Failed to update ticket status. Please try again.');
      }
    }
  };

  const logout = () => {
    if (API_BASE && managerToken) {
      fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: authHeaders(managerToken) }).catch(() => {});
    }
    sessionStorage.removeItem('mgr_token');
    sessionStorage.removeItem('mgr_info');
    setManagerToken('');
    setManagerInfo(null);
    setAuthed(false);
  };

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

  // Ticket search + pagination
  const filteredTickets = tickets.filter((t) => {
    if (!ticketSearch) return true;
    const q = ticketSearch.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
  });
  const totalTicketPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PAGE_SIZE));
  const safeTicketPage = Math.min(ticketPage, totalTicketPages);
  const paginatedTickets = filteredTickets.slice((safeTicketPage - 1) * TICKETS_PAGE_SIZE, safeTicketPage * TICKETS_PAGE_SIZE);

  // Build flat list of category names for article form dropdowns
  const allCategoryNames: string[] = dynamicCategories.length > 0
    ? dynamicCategories.map(c => c.name)
    : FALLBACK_CATEGORIES;

  const topLevelCats = dynamicCategories.filter(c => !c.parentId);
  const getSubcats = (parentId: string) => dynamicCategories.filter(c => c.parentId === parentId);

  const publishedCount = articles.filter((a) => a.status === 'published' || a.status === 'active').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;
  const openTickets = tickets.filter((t) => t.status !== 'solved' && t.status !== 'resolved').length;

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (!authChecked) {
    return <div style={{ position: 'fixed', inset: 0, background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-spinner fa-spin" style={{ color: '#00AB4E', fontSize: '2rem' }}></i></div>;
  }

  if (!authed) {
    const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0F172A 0%, #1A202C 50%, #2D3748 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Image src="/logo-dark.svg" alt="Indiabulls Securities" width={120} height={43} style={{ width: 120, height: 'auto', margin: '0 auto', display: 'block' }} />
          </div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#1A202C', marginBottom: '0.375rem' }}>Manager Portal</h1>
          <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '2rem' }}>Sign in to manage FAQ articles and support tickets</p>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '0.875rem' }}>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Username"
                disabled={isLocked || loginLoading}
                autoComplete="username"
                style={{ width: '100%', padding: '0.875rem 1rem', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1A202C' }}
              />
            </div>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Password"
                disabled={isLocked || loginLoading}
                autoComplete="current-password"
                style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 1rem', border: '2px solid #E2E8F0', borderRadius: 10, fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1A202C' }}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A0AEC0', fontSize: '0.875rem' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {authError && (
              <div style={{ background: '#FFF5F5', border: '1px solid #FEB2B2', color: '#C53030', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem', marginBottom: '0.75rem', textAlign: 'left' }}>
                {authError}
              </div>
            )}
            {isLocked && (
              <p style={{ color: '#DD6B20', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Login disabled. Try again in {Math.floor(lockoutSecsLeft / 60)}m {lockoutSecsLeft % 60}s.</p>
            )}
            <button type="submit" disabled={isLocked || loginLoading} style={{ width: '100%', padding: '0.875rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: isLocked || loginLoading ? 'not-allowed' : 'pointer', opacity: isLocked || loginLoading ? 0.5 : 1 }}>
              {loginLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#A0AEC0' }}>Authorized Indiabulls Securities Internal System · Authorized Access Only</p>
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
          <Image src="/logo.svg" alt="Indiabulls Securities" width={110} height={42} style={{ width: 110, height: 'auto', minWidth: 0, flexShrink: 1, display: 'block' }} />
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
            { id: 'audit', label: 'Audit Log', icon: 'fa-scroll' },
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
          <p style={{ fontSize: '0.65rem', color: '#4A5568', textAlign: 'center', padding: '0.5rem' }}>v1.0 · Manager Portal</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--admin-bg)', flex: 1, minWidth: 0 }}>
        {/* TOPBAR */}
        <div style={{ background: 'var(--admin-topbar)', borderBottom: '1px solid var(--admin-border)', padding: '0 1.25rem', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <button onClick={() => setSidebarOpen(true)} className="admin-hamburger" aria-label="Open menu" style={{ width: 36, height: 36, borderRadius: 8, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.875rem', flexShrink: 0 }}>
              <i className="fas fa-bars"></i>
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#00AB4E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-shield-alt" style={{ color: '#fff', fontSize: '0.875rem' }}></i>
            </div>
            <span style={{ fontWeight: 800, color: 'var(--admin-text-primary)', fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>Manager Portal</span>
            <span className="hide-mobile" style={{ fontSize: '0.7rem', background: '#FEF3C7', color: '#92400E', padding: '0.1rem 0.5rem', borderRadius: 20, fontWeight: 600, whiteSpace: 'nowrap' }}>{managerInfo?.role?.toUpperCase() || 'MANAGER'}</span>
            {managerInfo?.displayName && (
              <span className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38A169', display: 'inline-block', flexShrink: 0 }} />
                {managerInfo.displayName}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={fetchArticles} disabled={loading} title={lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'} style={{ background: 'none', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '0.4rem 0.625rem', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--admin-text-secondary)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: loading ? 0.6 : 1 }}>
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              <span className="hide-mobile">{lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}</span>
            </button>
            <button onClick={toggleDarkMode} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} style={{ background: 'none', border: '1px solid var(--admin-border)', borderRadius: 8, padding: '0.4rem 0.625rem', cursor: 'pointer', color: 'var(--admin-text-secondary)', fontSize: '0.875rem', display: 'flex', alignItems: 'center' }}>
              <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>
            <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <i className="fas fa-right-from-bracket"></i>
              <span className="hide-mobile">Sign out</span>
            </button>
          </div>
        </div>

        {/* TAB NAV — matches masteradmin style */}
        <div style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-topbar)', padding: '0 1.25rem', display: 'flex', gap: '0.25rem', overflowX: 'auto', flexShrink: 0 }}>
          {[
            { id: 'articles',   label: 'FAQ Articles', icon: 'fa-list' },
            { id: 'add',        label: editingId ? 'Edit Article' : 'Add Article', icon: 'fa-plus' },
            { id: 'categories', label: 'Categories', icon: 'fa-folder-tree' },
            { id: 'tickets',    label: 'Tickets', icon: 'fa-envelope' },
            { id: 'audit',      label: 'Audit Log', icon: 'fa-scroll' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveView(tab.id as 'articles' | 'add' | 'tickets' | 'audit' | 'categories'); if (tab.id !== 'add') { setEditingId(null); setForm(emptyForm); setFormMsg(''); } setSidebarOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.75rem 0.875rem', background: 'none', border: 'none', borderBottom: `2px solid ${activeView === tab.id ? '#00AB4E' : 'transparent'}`, color: activeView === tab.id ? '#00AB4E' : 'var(--admin-text-secondary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: activeView === tab.id ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0, transition: 'color 0.15s' }}
            >
              <i className={`fas ${tab.icon}`} style={{ fontSize: '0.8rem' }}></i>
              {tab.label}
              {tab.id === 'tickets' && openTickets > 0 && (
                <span style={{ background: '#F97316', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 20 }}>{openTickets} open</span>
              )}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingLeft: '1rem' }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.75rem 0.5rem', color: 'var(--admin-text-muted)', fontSize: '0.8125rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem' }}></i>
              <span className="hide-mobile">View Site</span>
            </Link>
          </div>
        </div>

        {/* SESSION EXPIRY WARNING */}
        {sessionWarning && (
          <div style={{ background: '#FFFBEB', borderBottom: '1px solid #F59E0B', padding: '0.625rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <i className="fas fa-clock" style={{ color: '#D97706', fontSize: '0.875rem' }}></i>
            <span style={{ fontSize: '0.8125rem', color: '#92400E', fontWeight: 600, flex: 1 }}>
              Your session expires soon. Save any unsaved work before you&apos;re signed out.
            </span>
            <button onClick={() => setSessionWarning(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400E', fontSize: '1rem', lineHeight: 1 }}>×</button>
          </div>
        )}

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
                    {loading ? (
                      <div style={{ width: 48, height: 26, borderRadius: 6, background: 'var(--admin-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ) : (
                      <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--admin-text-primary)', lineHeight: 1 }}>{s.value}</div>
                    )}
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
                  {allCategoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
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
                  onChange={(e) => { setSortBy(e.target.value as 'default' | 'title' | 'category'); setPage(1); }}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {orderChanged && (
                      <button onClick={saveOrder} disabled={savingOrder} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', background: '#00AB4E', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700, cursor: savingOrder ? 'not-allowed' : 'pointer', opacity: savingOrder ? 0.7 : 1 }}>
                        <i className={`fas ${savingOrder ? 'fa-spinner fa-spin' : 'fa-save'}`} style={{ fontSize: '0.7rem' }}></i>
                        {savingOrder ? 'Saving...' : 'Save Order'}
                      </button>
                    )}
                    <button onClick={() => { setEditingId(null); setForm(emptyForm); setFormMsg(''); setActiveView('add'); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer' }}>
                      <i className="fas fa-plus" style={{ fontSize: '0.7rem' }}></i> Add Article
                    </button>
                  </div>
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
                              <td style={{ padding: '0.875rem 1.25rem', width: 130 }}>
                                <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                  {sortBy === 'default' && !!catFilter && (() => {
                                    const gi = (safePage - 1) * PAGE_SIZE + i;
                                    const cat = catFilter;
                                    const peers = articles.map((a, idx) => idx).filter((idx) => articles[idx].category === cat);
                                    const peerPos = peers.indexOf(gi);
                                    const isFirst = peerPos === 0;
                                    const isLast = peerPos === peers.length - 1;
                                    return (<>
                                      <button onClick={() => moveArticle(gi, 'up', cat)} disabled={isFirst} title="Move Up" style={{ width: 34, height: 34, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: isFirst ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#718096', opacity: isFirst ? 0.3 : 1 }}>
                                        <i className="fas fa-arrow-up" style={{ fontSize: '0.75rem' }}></i>
                                      </button>
                                      <button onClick={() => moveArticle(gi, 'down', cat)} disabled={isLast} title="Move Down" style={{ width: 34, height: 34, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: isLast ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#718096', opacity: isLast ? 0.3 : 1 }}>
                                        <i className="fas fa-arrow-down" style={{ fontSize: '0.75rem' }}></i>
                                      </button>
                                    </>);
                                  })()}
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
                      {dynamicCategories.length > 0 ? (
                        topLevelCats.map(cat => {
                          const subs = getSubcats(cat.id);
                          return subs.length > 0 ? (
                            <optgroup key={cat.id} label={cat.name}>
                              <option value={cat.name}>{cat.name} (general)</option>
                              {subs.map(sub => <option key={sub.id} value={sub.name}>{sub.name}</option>)}
                            </optgroup>
                          ) : (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          );
                        })
                      ) : (
                        FALLBACK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                      )}
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
                    <p style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginTop: '0.25rem' }}>Write a clear, detailed answer. Max 50,000 characters.</p>
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

          {/* CATEGORIES VIEW */}
          {activeView === 'categories' && (
            <div style={{ maxWidth: 860 }}>
              {/* Add / Edit form */}
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: '1.25rem' }}>
                  {editingCatId ? 'Edit Category' : 'Add Category / Subcategory'}
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!catForm.name.trim()) { setCatFormMsg('Name is required.'); return; }
                  setCatSubmitting(true); setCatFormMsg('');
                  try {
                    const method = editingCatId ? 'PUT' : 'POST';
                    const url = editingCatId ? `${API_BASE}/categories/${editingCatId}` : `${API_BASE}/categories`;
                    const res = await fetch(url, {
                      method,
                      headers: authHeaders(managerToken),
                      body: JSON.stringify({ name: catForm.name.trim(), icon: catForm.icon, parentId: catForm.parentId || null }),
                    });
                    if (res.status === 401) { handleSessionExpired(); return; }
                    if (!res.ok) throw new Error('Failed');
                    setCatFormMsg(editingCatId ? 'Category updated!' : 'Category created!');
                    setCatForm({ name: '', icon: 'fas fa-folder', parentId: '' });
                    setEditingCatId(null);
                    fetchCategories();
                    setTimeout(() => setCatFormMsg(''), 2500);
                  } catch { setCatFormMsg(editingCatId ? 'Failed to update.' : 'Failed to create.'); }
                  finally { setCatSubmitting(false); }
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Name *</label>
                      <input
                        type="text"
                        value={catForm.name}
                        onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                        placeholder="e.g. Deposits"
                        maxLength={100}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Parent Category (leave blank for top-level)</label>
                      <select
                        value={catForm.parentId}
                        onChange={e => setCatForm({ ...catForm, parentId: e.target.value })}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--admin-surface)', color: 'var(--admin-text-primary)', boxSizing: 'border-box' }}
                      >
                        <option value="">— Top-level category —</option>
                        {dynamicCategories.filter(c => !c.parentId).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568', marginBottom: '0.375rem' }}>Icon class (FontAwesome)</label>
                    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={catForm.icon}
                        onChange={e => setCatForm({ ...catForm, icon: e.target.value })}
                        placeholder="fas fa-folder"
                        style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)' }}
                      />
                      <span style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)', width: 32, textAlign: 'center' }}>
                        <i className={catForm.icon || 'fas fa-folder'}></i>
                      </span>
                    </div>
                  </div>
                  {catFormMsg && (
                    <div style={{ padding: '0.625rem 1rem', borderRadius: 8, fontSize: '0.875rem', marginBottom: '0.875rem', background: catFormMsg.includes('!') && !catFormMsg.toLowerCase().includes('fail') ? '#F0FFF4' : '#FFF5F5', border: `1px solid ${catFormMsg.includes('!') && !catFormMsg.toLowerCase().includes('fail') ? '#9AE6B4' : '#FEB2B2'}`, color: catFormMsg.includes('!') && !catFormMsg.toLowerCase().includes('fail') ? '#276749' : '#C53030' }}>
                      {catFormMsg}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" disabled={catSubmitting} style={{ padding: '0.625rem 1.375rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, cursor: catSubmitting ? 'not-allowed' : 'pointer', opacity: catSubmitting ? 0.6 : 1 }}>
                      {catSubmitting ? (editingCatId ? 'Saving…' : 'Creating…') : (editingCatId ? 'Save Changes' : 'Create Category')}
                    </button>
                    {editingCatId && (
                      <button type="button" onClick={() => { setEditingCatId(null); setCatForm({ name: '', icon: 'fas fa-folder', parentId: '' }); setCatFormMsg(''); }} style={{ padding: '0.625rem 1.25rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', color: '#4A5568' }}>Cancel</button>
                    )}
                  </div>
                </form>
              </div>

              {/* Category tree */}
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>
                    All Categories <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>({dynamicCategories.length})</span>
                  </h2>
                  <button onClick={fetchCategories} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--admin-text-secondary)', fontSize: '0.875rem' }}>
                    <i className="fas fa-rotate-right"></i>
                  </button>
                </div>
                {catLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>Loading…</div>
                ) : catError ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: '#E53E3E', fontSize: '0.875rem' }}>{catError}</div>
                ) : dynamicCategories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No categories yet. Create your first one above.</div>
                ) : (
                  <div style={{ padding: '0.75rem 1.25rem' }}>
                    {topLevelCats.map(cat => {
                      const subs = getSubcats(cat.id);
                      return (
                        <div key={cat.id} style={{ marginBottom: '0.75rem' }}>
                          {/* Top-level row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', background: 'var(--admin-row-hover)', borderRadius: 8 }}>
                            <i className={cat.icon} style={{ color: '#00AB4E', width: 16, textAlign: 'center' }}></i>
                            <span style={{ flex: 1, fontWeight: 700, fontSize: '0.875rem', color: 'var(--admin-text-primary)' }}>{cat.name}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', background: 'var(--admin-border)', padding: '0.125rem 0.5rem', borderRadius: 20 }}>{subs.length} sub</span>
                            <button onClick={() => { setEditingCatId(cat.id); setCatForm({ name: cat.name, icon: cat.icon, parentId: '' }); setCatFormMsg(''); }} style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                              <i className="fas fa-pen" style={{ fontSize: '0.7rem' }}></i>
                            </button>
                            <button
                              disabled={!!deletingCatId}
                              onClick={async () => {
                                if (!confirm(`Delete "${cat.name}"? This will also remove all its subcategories from the sidebar.`)) return;
                                setDeletingCatId(cat.id);
                                try {
                                  const res = await fetch(`${API_BASE}/categories/${cat.id}`, { method: 'DELETE', headers: authHeaders(managerToken) });
                                  if (res.status === 401) { handleSessionExpired(); return; }
                                  if (!res.ok) throw new Error('Failed');
                                  fetchCategories();
                                  showToast('Category deleted.');
                                } catch { showToast('Failed to delete category.'); }
                                finally { setDeletingCatId(null); }
                              }}
                              style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #FEB2B2', background: 'var(--admin-surface)', cursor: deletingCatId ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53E3E', opacity: deletingCatId === cat.id ? 0.5 : 1 }}
                            >
                              <i className="fas fa-trash" style={{ fontSize: '0.7rem' }}></i>
                            </button>
                          </div>
                          {/* Subcategory rows */}
                          {subs.map(sub => (
                            <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', marginLeft: '1.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '1rem' }}>
                              <i className={sub.icon} style={{ color: '#718096', width: 14, textAlign: 'center', fontSize: '0.8rem' }}></i>
                              <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--admin-text-primary)' }}>{sub.name}</span>
                              <button onClick={() => { setEditingCatId(sub.id); setCatForm({ name: sub.name, icon: sub.icon, parentId: sub.parentId || '' }); setCatFormMsg(''); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                                <i className="fas fa-pen" style={{ fontSize: '0.65rem' }}></i>
                              </button>
                              <button
                                disabled={!!deletingCatId}
                                onClick={async () => {
                                  if (!confirm(`Delete subcategory "${sub.name}"?`)) return;
                                  setDeletingCatId(sub.id);
                                  try {
                                    const res = await fetch(`${API_BASE}/categories/${sub.id}`, { method: 'DELETE', headers: authHeaders(managerToken) });
                                    if (res.status === 401) { handleSessionExpired(); return; }
                                    if (!res.ok) throw new Error('Failed');
                                    fetchCategories();
                                    showToast('Subcategory deleted.');
                                  } catch { showToast('Failed to delete subcategory.'); }
                                  finally { setDeletingCatId(null); }
                                }}
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid #FEB2B2', background: 'var(--admin-surface)', cursor: deletingCatId ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53E3E', opacity: deletingCatId === sub.id ? 0.5 : 1 }}
                              >
                                <i className="fas fa-trash" style={{ fontSize: '0.65rem' }}></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {/* Orphan subcategories (parentId set but parent not found) */}
                    {dynamicCategories.filter(c => c.parentId && !dynamicCategories.find(p => p.id === c.parentId)).map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.875rem', background: '#FFFBEB', borderRadius: 8, marginBottom: '0.375rem' }}>
                        <i className={cat.icon} style={{ color: '#D97706', width: 14, textAlign: 'center' }}></i>
                        <span style={{ flex: 1, fontSize: '0.8125rem', color: '#92400E' }}>{cat.name} <span style={{ fontSize: '0.7rem' }}>(orphaned — parent missing)</span></span>
                        <button onClick={() => { setEditingCatId(cat.id); setCatForm({ name: cat.name, icon: cat.icon, parentId: cat.parentId || '' }); setCatFormMsg(''); }} style={{ width: 28, height: 28, borderRadius: 6, border: '1.5px solid var(--admin-border)', background: 'var(--admin-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                          <i className="fas fa-pen" style={{ fontSize: '0.65rem' }}></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TICKETS VIEW */}
          {activeView === 'tickets' && (
            <div>
              {/* Ticket search bar */}
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', padding: '0.875rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <i className="fas fa-search" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)', fontSize: '0.75rem', pointerEvents: 'none' }}></i>
                  <input
                    type="text"
                    value={ticketSearch}
                    onChange={(e) => { setTicketSearch(e.target.value); setTicketPage(1); }}
                    placeholder="Search by name, email, subject or ID..."
                    style={{ width: '100%', padding: '0.5rem 0.875rem 0.5rem 2rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box', background: 'var(--admin-input-bg)', color: 'var(--admin-text-primary)' }}
                  />
                </div>
                {ticketSearch && (
                  <button onClick={() => { setTicketSearch(''); setTicketPage(1); }} style={{ padding: '0.4rem 0.75rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--admin-text-secondary)' }}>Clear</button>
                )}
              </div>
              <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
                <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>
                    Support Tickets <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>({filteredTickets.length}{ticketSearch ? ` of ${tickets.length}` : ''} total, {openTickets} open)</span>
                  </h2>
                </div>
                {ticketsLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', marginBottom: '0.75rem', display: 'block' }}></i>
                    <p style={{ fontSize: '0.875rem' }}>Loading tickets…</p>
                  </div>
                ) : ticketsError ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem', color: '#E53E3E' }}><i className="fas fa-exclamation-circle"></i></div>
                    <p style={{ color: '#E53E3E', fontSize: '0.875rem', marginBottom: '1rem' }}>{ticketsError}</p>
                    <button onClick={() => fetchTickets(managerToken)} style={{ padding: '0.5rem 1rem', background: '#1A202C', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Retry</button>
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--admin-text-muted)' }}><i className="fas fa-ticket"></i></div>
                    <p style={{ fontSize: '0.875rem' }}>{ticketSearch ? `No tickets match "${ticketSearch}".` : 'No support tickets yet. Tickets submitted via the Contact page will appear here.'}</p>
                  </div>
                ) : (
                  <>
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: 'var(--admin-row-hover)' }}>
                        {['Ticket ID', 'Name', 'Email', 'Category', 'Subject', 'Status', 'Date', ''].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTickets.map((ticket) => (
                        <tr key={ticket.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                          <td style={{ padding: '0.875rem 1.25rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{ticket.id}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--admin-text-primary)' }}>{ticket.name}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{ticket.email}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>{ticket.category}</td>
                          <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--admin-text-primary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.subject}</td>
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <span style={{ display: 'inline-flex', padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700,
                              background: (ticket.status === 'solved' || ticket.status === 'resolved') ? '#F0FFF4' : ticket.status === 'in_progress' ? '#EFF6FF' : '#FFFBEB',
                              color: (ticket.status === 'solved' || ticket.status === 'resolved') ? '#276749' : ticket.status === 'in_progress' ? '#1E40AF' : '#744210' }}>
                              {ticket.status === 'in_progress' ? 'In Progress' : ticket.status === 'solved' || ticket.status === 'resolved' ? 'Solved' : ticket.status || 'Open'}
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
                  </div>
                  {totalTicketPages > 1 && (
                    <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #EDF2F7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button onClick={() => setTicketPage(p => Math.max(1, p - 1))} disabled={safeTicketPage === 1} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, background: 'var(--admin-surface)', cursor: safeTicketPage === 1 ? 'not-allowed' : 'pointer', opacity: safeTicketPage === 1 ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Previous</button>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--admin-text-secondary)' }}>Page {safeTicketPage} of {totalTicketPages}</span>
                      <button onClick={() => setTicketPage(p => Math.min(totalTicketPages, p + 1))} disabled={safeTicketPage === totalTicketPages} style={{ padding: '0.375rem 0.875rem', border: '1.5px solid var(--admin-border)', borderRadius: 8, background: 'var(--admin-surface)', cursor: safeTicketPage === totalTicketPages ? 'not-allowed' : 'pointer', opacity: safeTicketPage === totalTicketPages ? 0.4 : 1, fontSize: '0.8125rem', fontWeight: 600, color: '#4A5568' }}>Next</button>
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          )}
          {/* AUDIT LOG VIEW */}
          {activeView === 'audit' && (
            <div style={{ background: 'var(--admin-surface)', borderRadius: 12, border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
              <div style={{ padding: '1.125rem 1.25rem', borderBottom: '1px solid var(--admin-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: 'var(--admin-text-primary)' }}>
                  Audit Log <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>({auditLogs.length} entries — your actions only)</span>
                </h2>
                <button onClick={() => fetchAuditLogs(managerToken)} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 8, cursor: 'pointer', color: 'var(--admin-text-secondary)', fontSize: '0.875rem' }}>
                  <i className="fas fa-rotate-right"></i>
                </button>
              </div>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.25rem', marginBottom: '0.5rem', display: 'block' }}></i> Loading…
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--admin-text-muted)', fontSize: '0.875rem' }}>No audit entries yet. Your actions will appear here.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: 'var(--admin-row-hover)' }}>
                        {['Time', 'Action', 'Entity', 'Title / ID', 'Details'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '0.75rem 1.25rem', borderBottom: '2px solid #EDF2F7', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                          <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                          <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--admin-text-primary)', whiteSpace: 'nowrap' }}>{log.action}</td>
                          <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8rem', color: 'var(--admin-text-secondary)' }}>{log.entity}</td>
                          <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.8rem', color: 'var(--admin-text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entityTitle || log.entityId || '—'}</td>
                          <td style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>{log.meta ? Object.entries(log.meta).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
              {(previewTicket.description || previewTicket.message) && (
                <div style={{ marginTop: '0.75rem' }}>
                  <dt style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>Description</dt>
                  <dd style={{ background: '#F7FAFC', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem', color: 'var(--admin-text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{previewTicket.description || previewTicket.message}</dd>
                </div>
              )}
            </dl>
            {previewTicket.status !== 'solved' && previewTicket.status !== 'resolved' ? (
              <button onClick={() => handleMarkResolved(previewTicket.id)} style={{ width: '100%', padding: '0.875rem', background: '#38A169', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}>
                Mark as Solved
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#F0FFF4', borderRadius: 10, border: '1px solid #9AE6B4' }}>
                <i className="fas fa-check-circle" style={{ color: '#38A169', marginRight: '0.5rem' }}></i>
                <span style={{ color: '#276749', fontWeight: 600, fontSize: '0.875rem' }}>Ticket has been solved.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', background: '#1A202C', color: 'white', padding: '0.75rem 1.5rem', borderRadius: 10, fontSize: '0.875rem', fontWeight: 600, zIndex: 80, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-check-circle" style={{ color: '#68D391' }}></i>
          {toast}
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
                disabled={!!deletingId}
                style={{ flex: 1, padding: '0.75rem', background: 'var(--admin-surface)', border: '1.5px solid var(--admin-border)', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 600, cursor: deletingId ? 'not-allowed' : 'pointer', color: 'var(--admin-text-primary)', opacity: deletingId ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!!deletingId}
                style={{ flex: 1, padding: '0.75rem', background: '#E53E3E', color: 'white', border: 'none', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700, cursor: deletingId ? 'wait' : 'pointer', opacity: deletingId ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {deletingId ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: '0.875rem' }}></i> Deleting...</> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
