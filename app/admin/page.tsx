'use client';

// Metadata cannot be exported from a 'use client' component.
// To add metadata, create app/admin/layout.tsx with the metadata export.

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

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

// ── SVG icons ──────────────────────────────────────────────────────────────

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const IconPencil = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110.414 16H9v-1.414a2 2 0 01.586-1.414z" />
  </svg>
);

const IconEye = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const IconEyeOff = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.293-3.95M6.938 6.938A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-2.63 4.062M6.938 6.938L3 3m3.938 3.938l10.124 10.124M17.062 17.062L21 21" />
  </svg>
);

const Spinner = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <div className={`${className} border-2 border-current border-t-transparent rounded-full animate-spin`} />
);

// ── Main component ─────────────────────────────────────────────────────────

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

  // Form (add/edit)
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);
  const [previewTicket, setPreviewTicket] = useState<Ticket | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'articles' | 'tickets'>('articles');

  // Tickets (localStorage)
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // ── Auth effects ──────────────────────────────────────────────────────────

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
      return () => {
        if (lockoutTimerRef.current) clearInterval(lockoutTimerRef.current);
      };
    }
  }, [lockoutUntil]);

  // Load tickets from localStorage
  useEffect(() => {
    if (authed) {
      try {
        const raw = localStorage.getItem('is_tickets');
        if (raw) setTickets(JSON.parse(raw) as Ticket[]);
      } catch {
        setTickets([]);
      }
    }
  }, [authed]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
        setAuthError(`Too many failed attempts. Login disabled for ${LOCKOUT_SECONDS} seconds.`);
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
    } catch {
      setError('Failed to load articles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) fetchArticles();
  }, [authed, fetchArticles]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.content) {
      setFormMsg('All fields are required.');
      return;
    }
    setSubmitting(true);
    setFormMsg('');
    try {
      if (editingId) {
        // Edit mode: PUT/POST with id
        const res = await fetch(`${API_BASE}/faq`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Time': new Date().toISOString(),
            'X-Client-Version': '1.0',
          },
          body: JSON.stringify({ ...form, id: editingId }),
        });
        if (!res.ok) throw new Error('Failed to update article');
        setFormMsg('Article updated successfully!');
      } else {
        // Add mode: POST without id
        const res = await fetch(`${API_BASE}/faq`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Time': new Date().toISOString(),
            'X-Client-Version': '1.0',
          },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to add article');
        setFormMsg('Article added successfully!');
      }
      setForm(emptyForm);
      setEditingId(null);
      fetchArticles();
    } catch {
      setFormMsg(editingId ? 'Failed to update article. Please try again.' : 'Failed to add article. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (article: Article) => {
    setForm({
      title: article.title || article.question || '',
      category: article.category || '',
      content: article.content || article.answer || '',
      status: article.status || 'published',
    });
    setEditingId(article.id);
    setFormMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormMsg('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/faq/${id}`, {
        method: 'DELETE',
        headers: {
          'X-Request-Time': new Date().toISOString(),
          'X-Client-Version': '1.0',
        },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('Failed to delete article. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (article: Article) => {
    const isPublished = article.status === 'published' || article.status === 'active';
    const newStatus = isPublished ? 'draft' : 'published';
    setTogglingId(article.id);
    try {
      const res = await fetch(`${API_BASE}/faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Time': new Date().toISOString(),
          'X-Client-Version': '1.0',
        },
        body: JSON.stringify({ id: article.id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, status: newStatus } : a))
      );
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleMarkResolved = (ticketId: string) => {
    const updated = tickets.map((t) =>
      t.id === ticketId ? { ...t, status: 'resolved' } : t
    );
    setTickets(updated);
    localStorage.setItem('is_tickets', JSON.stringify(updated));
    if (previewTicket?.id === ticketId) {
      setPreviewTicket((prev) => (prev ? { ...prev, status: 'resolved' } : prev));
    }
  };

  const logout = () => {
    sessionStorage.removeItem('admin_auth');
    setAuthed(false);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = articles.filter((a) =>
    !search ||
    (a.title || a.question || '')?.toLowerCase().includes(search.toLowerCase()) ||
    a.category?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const contentLen = form.content.length;

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) {
    const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-800 dark:bg-gray-700">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-1">Enter admin password to continue</p>
          </div>
          <form onSubmit={handleLogin} className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Password</label>
              {/* Fix #3: Show/Hide password toggle */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter admin password"
                  disabled={isLocked}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            {isLocked && (
              <p className="text-sm text-orange-500 font-medium">
                Login disabled. Try again in {lockoutSecsLeft}s.
              </p>
            )}
            {!isLocked && attempts > 0 && attempts < MAX_ATTEMPTS && (
              <p className="text-xs text-gray-400">
                Failed attempt {attempts} of {MAX_ATTEMPTS}
              </p>
            )}
            <button
              type="submit"
              disabled={isLocked}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: '#00C805' }}
            >
              Access Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Fix #5 & #6: Header with View Site link and Admin indicator */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-gray-500 text-sm">Manage FAQ articles</p>
            {/* Fix #6: Logged in as Admin indicator */}
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Fix #5: View Site link */}
          <Link
            href="/"
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ← View Site
          </Link>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Fix #7: Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['articles', 'tickets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-green-500 text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'articles' ? 'FAQ Articles' : 'Support Tickets'}
            {tab === 'tickets' && tickets.length > 0 && (
              <span className="ml-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-1.5 py-0.5 rounded-full">
                {tickets.filter((t) => t.status !== 'resolved').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── FAQ Articles Tab ── */}
      {activeTab === 'articles' && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Add / Edit Article Form */}
          <div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              {/* Fix #1: Dynamic title */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {editingId ? 'Edit Article' : 'Add New Article'}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 underline"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Article title"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  {/* Fix #9: Character counter */}
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">Content</label>
                    <span className={`text-xs ${
                      contentLen > MAX_CONTENT
                        ? 'text-red-500 font-semibold'
                        : contentLen > WARN_CONTENT
                        ? 'text-orange-500'
                        : 'text-gray-400'
                    }`}>
                      {contentLen} / {MAX_CONTENT} characters
                    </span>
                  </div>
                  <textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Article content..."
                    rows={5}
                    className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 resize-none ${
                      contentLen > MAX_CONTENT
                        ? 'border-red-400 focus:ring-red-400'
                        : contentLen > WARN_CONTENT
                        ? 'border-orange-400 focus:ring-orange-400'
                        : 'border-gray-200 dark:border-gray-700 focus:ring-green-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                {formMsg && (
                  <p className={`text-xs ${formMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                    {formMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting || contentLen > MAX_CONTENT}
                  className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-70 transition-colors"
                  style={{ backgroundColor: '#00C805' }}
                >
                  {submitting
                    ? (editingId ? 'Updating...' : 'Adding...')
                    : (editingId ? 'Update Article' : 'Add Article')}
                </button>
              </form>
            </div>
          </div>

          {/* Article list */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Articles <span className="text-sm text-gray-400 font-normal">({filtered.length})</span>
              </h2>
              {/* Fix #4: w-full sm:w-48 */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-48"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-500 mb-4">{error}</p>
                <button onClick={fetchArticles} className="px-4 py-2 text-white rounded-lg text-sm" style={{ backgroundColor: '#00C805' }}>
                  Retry
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                {search ? `No articles matching "${search}"` : 'No articles found. Add one!'}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {paginated.map((article) => {
                    const isPublished = article.status === 'published' || article.status === 'active';
                    const isToggling = togglingId === article.id;
                    const isDeleting = deletingId === article.id;
                    return (
                      <div
                        key={article.id}
                        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {article.title || article.question || 'Untitled'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{article.category}</span>
                            {/* Fix #2: Publish/Unpublish toggle pill */}
                            {article.status !== undefined && (
                              <button
                                onClick={() => handleToggleStatus(article)}
                                disabled={isToggling}
                                className={`text-xs px-1.5 py-0.5 rounded-full transition-colors flex items-center gap-1 ${
                                  isPublished
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                                title={isPublished ? 'Click to unpublish' : 'Click to publish'}
                              >
                                {isToggling
                                  ? <Spinner className="w-3 h-3" />
                                  : isPublished ? 'Published' : 'Draft'}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                            {article.content || article.answer || ''}
                          </p>
                        </div>
                        {/* Action buttons: Preview, Edit, Delete */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Fix #8: Preview button */}
                          <button
                            onClick={() => setPreviewArticle(article)}
                            className="p-2 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            title="Preview article"
                          >
                            <IconEye />
                          </button>
                          {/* Fix #1: Edit button */}
                          <button
                            onClick={() => handleEdit(article)}
                            className="p-2 rounded-lg text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                            title="Edit article"
                          >
                            <IconPencil />
                          </button>
                          {/* Delete button */}
                          <button
                            onClick={() => handleDelete(article.id)}
                            disabled={isDeleting}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete article"
                          >
                            {isDeleting
                              ? <Spinner className="w-4 h-4 text-red-400" />
                              : <IconTrash />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Fix #10: Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Support Tickets Tab ── */}
      {activeTab === 'tickets' && (
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
            Support Tickets <span className="text-sm text-gray-400 font-normal">({tickets.length})</span>
          </h2>
          {tickets.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No support tickets yet
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-left">
                  <tr>
                    {['Ticket ID', 'Name', 'Email', 'Category', 'Subject', 'Status', 'Date', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticket.id}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{ticket.name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ticket.email}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ticket.category}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white max-w-[180px] truncate">{ticket.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ticket.status === 'resolved'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}>
                          {ticket.status || 'open'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{ticket.date}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setPreviewTicket(ticket)}
                          className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Article Preview Modal ── */}
      {previewArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewArticle(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-snug pr-4">
                {previewArticle.title || previewArticle.question || 'Untitled'}
              </h3>
              <button
                onClick={() => setPreviewArticle(null)}
                className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {previewArticle.category}
              </span>
              {previewArticle.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  previewArticle.status === 'published' || previewArticle.status === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                  {previewArticle.status}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {previewArticle.content || previewArticle.answer || ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Ticket Detail Modal ── */}
      {previewTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewTicket(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg leading-snug pr-4">
                Ticket Details
              </h3>
              <button
                onClick={() => setPreviewTicket(null)}
                className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <dl className="space-y-3 text-sm mb-6">
              {[
                ['Ticket ID', previewTicket.id],
                ['Name', previewTicket.name],
                ['Email', previewTicket.email],
                ['Phone', previewTicket.phone],
                ['Category', previewTicket.category],
                ['Subject', previewTicket.subject],
                ['Status', previewTicket.status || 'open'],
                ['Date', previewTicket.date],
              ].map(([label, value]) =>
                value ? (
                  <div key={label} className="flex gap-2">
                    <dt className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">{label}</dt>
                    <dd className="text-gray-900 dark:text-white flex-1">{value}</dd>
                  </div>
                ) : null
              )}
              {previewTicket.message && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400 font-medium mb-1">Message</dt>
                  <dd className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm whitespace-pre-wrap leading-relaxed">
                    {previewTicket.message}
                  </dd>
                </div>
              )}
            </dl>
            {previewTicket.status !== 'resolved' && (
              <button
                onClick={() => handleMarkResolved(previewTicket.id)}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#00C805' }}
              >
                Mark as Resolved
              </button>
            )}
            {previewTicket.status === 'resolved' && (
              <p className="text-center text-sm text-green-600 dark:text-green-400 font-medium">
                This ticket has been resolved.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
