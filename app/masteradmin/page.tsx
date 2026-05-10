'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  entityTitle?: string;
  performedBy: string;
  meta?: Record<string, string>;
}

interface Manager {
  managerId: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface AnalyticsSummary {
  period_days: number;
  article_views: number;
  searches: number;
  chatbot_opens: number;
  chatbot_messages: number;
  ticket_submits: number;
  faq_feedback_helpful: number;
  faq_feedback_not_helpful: number;
  top_articles: [string, number][];
  top_searches: [string, number][];
  persona_counts: Record<string, number>;
  tickets_by_category: Record<string, number>;
}

interface Ticket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: 'open' | 'in_progress' | 'solved' | 'resolved';
  createdAt: string;
  description?: string;
  phone?: string;
}

interface Article {
  id: string;
  title: string;
  category: string;
  status: string;
}

type Tab = 'overview' | 'managers' | 'audit' | 'tickets' | 'faq' | 'analytics';

// Master session token is obtained via POST /auth/masterlogin (server-side validation).
// The raw master password is NEVER stored in the browser bundle or client state.
function getMasterHeaders(): Record<string, string> {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('master_token') || '' : '';
  return { 'Content-Type': 'application/json', 'X-Master-Token': token };
}

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  CREATE_FAQ:          { label: 'FAQ Created',          icon: 'fa-plus-circle',   color: '#065F46', bg: '#D1FAE5' },
  UPDATE_FAQ:          { label: 'FAQ Updated',          icon: 'fa-edit',          color: '#1E40AF', bg: '#DBEAFE' },
  DELETE_FAQ:          { label: 'FAQ Deleted',          icon: 'fa-trash',         color: '#991B1B', bg: '#FEE2E2' },
  UPDATE_TICKET:       { label: 'Ticket Updated',       icon: 'fa-ticket-alt',    color: '#92400E', bg: '#FEF3C7' },
  CREATE_TICKET:       { label: 'Ticket Submitted',     icon: 'fa-inbox',         color: '#5B21B6', bg: '#EDE9FE' },
  LOGIN:               { label: 'Manager Login',        icon: 'fa-sign-in-alt',   color: '#374151', bg: '#F3F4F6' },
  LOGIN_SUCCESS:       { label: 'Manager Login',        icon: 'fa-sign-in-alt',   color: '#065F46', bg: '#D1FAE5' },
  LOGIN_FAIL:          { label: 'Login Failed',         icon: 'fa-times-circle',  color: '#991B1B', bg: '#FEE2E2' },
  LOGIN_BLOCKED:       { label: 'Login Blocked',        icon: 'fa-ban',           color: '#991B1B', bg: '#FEE2E2' },
  LOGOUT:              { label: 'Logged Out',           icon: 'fa-sign-out-alt',  color: '#374151', bg: '#F3F4F6' },
  MASTER_LOGIN_SUCCESS:{ label: 'Master Login',         icon: 'fa-shield-alt',    color: '#1E40AF', bg: '#DBEAFE' },
  MASTER_LOGIN_FAIL:   { label: 'Master Login Failed',  icon: 'fa-shield-exclamation', color: '#991B1B', bg: '#FEE2E2' },
  CREATE_MANAGER:      { label: 'Manager Created',      icon: 'fa-user-plus',     color: '#065F46', bg: '#D1FAE5' },
  UPDATE_MANAGER:      { label: 'Manager Updated',      icon: 'fa-user-edit',     color: '#1E40AF', bg: '#DBEAFE' },
  DELETE_MANAGER:      { label: 'Manager Deleted',      icon: 'fa-user-minus',    color: '#991B1B', bg: '#FEE2E2' },
};

// Manager accounts derived from audit log — anyone who has performed an action
// In a real system these would come from an ib-managers table; here we infer from audit logs.

const STATUS_CONFIG = {
  open:        { label: 'Open',        bg: '#FEF3C7', color: '#92400E' },
  in_progress: { label: 'In Progress', bg: '#DBEAFE', color: '#1E40AF' },
  solved:      { label: 'Solved',      bg: '#D1FAE5', color: '#065F46' },
};

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60;

// ─── Component ────────────────────────────────────────────────────────────────

export default function MasterAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockSecs, setLockSecs] = useState(0);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [ticketFilter, setTicketFilter] = useState<string>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [faqSearch, setFaqSearch] = useState('');

  // Managers CRUD
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState('');
  const [showCreateManager, setShowCreateManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ username: '', displayName: '', email: '', role: 'manager', password: '' });
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [managerFormMsg, setManagerFormMsg] = useState('');
  const [managerFormSaving, setManagerFormSaving] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [confirmManagerAction, setConfirmManagerAction] = useState<{ managerId: string; newStatus: string; displayName: string } | null>(null);

  // Analytics
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsDays, setAnalyticsDays] = useState(30);

  useEffect(() => {
    setMounted(true);
    // Validate stored master token expiry on mount — don't wait for first API call
    const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('master_token') : null;
    if (stored) {
      try {
        const payload = JSON.parse(atob(stored.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp && payload.exp > Math.floor(Date.now() / 1000)) {
          setAuthed(true);
        } else {
          sessionStorage.removeItem('master_token');
        }
      } catch {
        sessionStorage.removeItem('master_token');
      }
    }
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (!lockedUntil) return;
    const iv = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) { setLockedUntil(null); setLockSecs(0); clearInterval(iv); }
      else setLockSecs(left);
    }, 1000);
    return () => clearInterval(iv);
  }, [lockedUntil]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && Date.now() < lockedUntil) return;
    if (!API_BASE) { setAuthError('System misconfiguration: API not configured.'); return; }

    try {
      const res = await fetch(`${API_BASE}/auth/masterlogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      setPasswordInput('');

      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('master_token', data.token);
        setAuthed(true);
        setAuthError('');
        setAttempts(0);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockedUntil(until);
          setAuthError(`Too many attempts. Locked for ${LOCKOUT_SECONDS}s.`);
        } else {
          setAuthError(`Invalid password. ${MAX_ATTEMPTS - next} attempt(s) remaining.`);
        }
      }
    } catch {
      setPasswordInput('');
      setAuthError('Network error. Please try again.');
    }
  };

  const handleSessionExpired = useCallback(() => {
    sessionStorage.removeItem('master_token');
    setAuthed(false);
    setAuthError('Your session has expired. Please log in again.');
  }, []);

  const fetchManagers = useCallback(async () => {
    if (!API_BASE) return;
    setManagersLoading(true);
    setManagersError('');
    try {
      const res = await fetch(`${API_BASE}/managers`, { headers: getMasterHeaders() });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (res.ok) setManagers(await res.json());
      else setManagersError(`Failed to load managers (${res.status}). Try refreshing.`);
    } catch { setManagersError('Could not reach the API. Check your connection.'); }
    finally { setManagersLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async (days: number) => {
    if (!API_BASE) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics/summary?days=${days}`, { headers: getMasterHeaders() });
      if (res.status === 401) { handleSessionExpired(); return; }
      if (res.ok) setAnalytics(await res.json());
    } catch { /* silently ignore — main loadError covers connectivity failures */ }
    finally { setAnalyticsLoading(false); }
  }, [handleSessionExpired]);

  const fetchAll = useCallback(async () => {
    if (!API_BASE) { setLoadError('API not configured.'); return; }
    setLoading(true);
    setLoadError('');
    try {
      const [ticketsRes, faqRes, auditRes] = await Promise.allSettled([
        fetch(`${API_BASE}/tickets`, { headers: getMasterHeaders() }),
        fetch(`${API_BASE}/faq`),
        fetch(`${API_BASE}/audit-log`, { headers: getMasterHeaders() }),
      ]);

      // Any 401 on authenticated resources means the master session expired
      if (
        (ticketsRes.status === 'fulfilled' && ticketsRes.value.status === 401) ||
        (auditRes.status === 'fulfilled' && auditRes.value.status === 401)
      ) { handleSessionExpired(); return; }

      if (ticketsRes.status === 'fulfilled' && ticketsRes.value.ok) {
        setTickets(await ticketsRes.value.json());
      }
      if (faqRes.status === 'fulfilled' && faqRes.value.ok) {
        setArticles(await faqRes.value.json());
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const logs: AuditLog[] = await auditRes.value.json();
        setAuditLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch {
      setLoadError('Failed to load data from API.');
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    if (authed) {
      fetchAll();
      fetchManagers();
      fetchAnalytics(analyticsDays);
    }
  }, [authed, fetchAll, fetchManagers, fetchAnalytics, analyticsDays]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = {
    totalTickets: tickets.length,
    openTickets: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
    solvedTickets: tickets.filter(t => t.status === 'solved').length,
    totalFaq: articles.length,
    publishedFaq: articles.filter(a => a.status === 'published').length,
    totalAuditLogs: auditLogs.length,
    todayActions: auditLogs.filter(l => {
      const d = new Date(l.timestamp);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
  };

  const filteredLogs = auditLogs.filter(l => {
    const matchFilter = auditFilter === 'all' || l.action === auditFilter || l.entity === auditFilter;
    const q = auditSearch.toLowerCase();
    const matchSearch = !q || l.entityTitle?.toLowerCase().includes(q) || l.entityId.toLowerCase().includes(q) || l.performedBy.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const filteredTickets = tickets.filter(t => {
    // Treat legacy 'resolved' as 'solved' for filter consistency
    const status = t.status === 'resolved' ? 'solved' : t.status;
    const matchFilter = ticketFilter === 'all' || status === ticketFilter;
    const q = ticketSearch.toLowerCase();
    const matchSearch = !q || t.subject?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.name?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const filteredArticles = articles.filter(a => {
    const q = faqSearch.toLowerCase();
    return !q || a.title?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
  });

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Must be defined before any early return (Rules of Hooks) ─────────────
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',   label: 'Overview',        icon: 'fa-tachometer-alt' },
    { id: 'managers',   label: 'Manager Accounts', icon: 'fa-users-cog' },
    { id: 'audit',      label: 'Audit Log',        icon: 'fa-history' },
    { id: 'analytics',  label: 'Analytics',        icon: 'fa-chart-bar' },
    { id: 'tickets',    label: 'Tickets',          icon: 'fa-ticket-alt' },
    { id: 'faq',        label: 'FAQ Articles',     icon: 'fa-book' },
  ];

  const managerSummary = useMemo(() => {
    const map: Record<string, { name: string; actions: number; lastSeen: string; faqCreated: number; faqUpdated: number; faqDeleted: number; ticketsUpdated: number }> = {};
    for (const log of auditLogs) {
      const who = log.performedBy || 'admin';
      if (who === 'public') continue;
      if (!map[who]) map[who] = { name: who, actions: 0, lastSeen: log.timestamp, faqCreated: 0, faqUpdated: 0, faqDeleted: 0, ticketsUpdated: 0 };
      map[who].actions++;
      if (new Date(log.timestamp) > new Date(map[who].lastSeen)) map[who].lastSeen = log.timestamp;
      if (log.action === 'CREATE_FAQ') map[who].faqCreated++;
      if (log.action === 'UPDATE_FAQ') map[who].faqUpdated++;
      if (log.action === 'DELETE_FAQ') map[who].faqDeleted++;
      if (log.action === 'UPDATE_TICKET') map[who].ticketsUpdated++;
    }
    return Object.values(map).sort((a, b) => b.actions - a.actions);
  }, [auditLogs]);

  const filteredManagers = useMemo(() => {
    if (!managerSearch) return managers;
    const q = managerSearch.toLowerCase();
    return managers.filter(m => m.username?.toLowerCase().includes(q) || m.displayName?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  }, [managers, managerSearch]);

  if (!mounted) return null;

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    const isLocked = !!lockedUntil && Date.now() < lockedUntil;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #0F172A 0%, #1A202C 50%, #2D3748 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 9999 }}>
        <div style={{ background: 'var(--admin-modal-bg)', borderRadius: 16, padding: '3rem 2.5rem', width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.4)', textAlign: 'center' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <Image src="/logo.svg" alt="Indiabulls Securities" width={160} height={36} style={{ height: 36, width: 'auto', margin: '0 auto' }} />
            </div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--admin-text-primary)', marginBottom: '0.375rem' }}>Master Admin</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--admin-text-secondary)' }}>Manager of Admins — restricted access only</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Master password"
                disabled={isLocked}
                style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 1rem', border: `2px solid ${authError ? '#EF4444' : '#E2E8F0'}`, borderRadius: 10, fontSize: '0.9375rem', outline: 'none', background: isLocked ? '#F7FAFC' : '#fff', color: '#1A202C', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowPassword(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>

            {authError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-exclamation-triangle"></i>
                {isLocked ? `Account locked. Try again in ${lockSecs}s.` : authError}
              </div>
            )}

            <button type="submit" disabled={isLocked || !passwordInput} style={{ width: '100%', padding: '0.875rem', background: isLocked ? '#9CA3AF' : '#1A202C', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.9375rem', cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked || !passwordInput ? 0.5 : 1, transition: 'opacity 0.15s' }}>
              {isLocked ? `Locked (${lockSecs}s)` : 'Access Dashboard'}
            </button>
          </form>
          <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--admin-text-muted)' }}>Authorized Indiabulls Securities Internal System · Restricted Access Only</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-subtle)' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#00AB4E,#007a37)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-shield-alt" style={{ color: '#fff', fontSize: '0.875rem' }}></i>
          </div>
          <div>
            <span style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '0.9375rem' }}>Master Admin</span>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: '#FEF3C7', color: '#92400E', padding: '0.1rem 0.5rem', borderRadius: 20, fontWeight: 600 }}>MANAGER OF ADMINS</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Updated {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchAll} disabled={loading} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.75rem', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: loading ? 0.6 : 1 }}>
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            {lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Refresh'}
          </button>
          <button onClick={() => { sessionStorage.removeItem('master_token'); setAuthed(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <i className="fas fa-sign-out-alt"></i> Sign out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', gap: '0.25rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); }}
            style={{ padding: '0.875rem 1.125rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: activeTab === tab.id ? 700 : 500, color: activeTab === tab.id ? '#00AB4E' : 'var(--text-muted)', borderBottom: `2px solid ${activeTab === tab.id ? '#00AB4E' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'color 0.15s' }}
          >
            <i className={`fas ${tab.icon}`}></i> {tab.label}
            {tab.id === 'tickets' && stats.openTickets > 0 && (
              <span style={{ background: '#F59E0B', color: '#fff', borderRadius: 20, fontSize: '0.65rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>{stats.openTickets} open</span>
            )}
            {tab.id === 'audit' && auditLogs.length > 0 && (
              <span style={{ background: '#6B7280', color: '#fff', borderRadius: 20, fontSize: '0.65rem', padding: '0.1rem 0.45rem', fontWeight: 700 }}>{auditLogs.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loadError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1.5rem', color: '#B91C1C', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-exclamation-circle"></i> {loadError}
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '1.5rem' }}>System Overview</h2>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Active Managers', value: managers.filter(m => m.status === 'active').length, icon: 'fa-users-cog', color: '#00AB4E', bg: '#D1FAE5' },
                { label: 'Total Tickets',   value: stats.totalTickets,      icon: 'fa-ticket-alt',    color: '#5B21B6', bg: '#EDE9FE' },
                { label: 'Open / In-Progress', value: stats.openTickets,   icon: 'fa-hourglass-half', color: '#92400E', bg: '#FEF3C7' },
                { label: 'Solved',          value: stats.solvedTickets,     icon: 'fa-check-circle',  color: '#065F46', bg: '#D1FAE5' },
                { label: 'FAQ Articles',    value: stats.totalFaq,          icon: 'fa-book',          color: '#1E40AF', bg: '#DBEAFE' },
                { label: "Today's Actions", value: stats.todayActions,      icon: 'fa-bolt',          color: '#92400E', bg: '#FEF3C7' },
                { label: 'Total Audit Logs',value: stats.totalAuditLogs,    icon: 'fa-history',       color: '#374151', bg: '#F3F4F6' },
              ].map(kpi => (
                <div key={kpi.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fas ${kpi.icon}`} style={{ color: kpi.color, fontSize: '1.125rem' }}></i>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{kpi.label}</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>{loading ? '—' : kpi.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Manager quick view */}
            {managerSummary.length > 0 && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem' }}>Manager Activity</h3>
                  <button onClick={() => setActiveTab('managers')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00AB4E', fontSize: '0.8125rem', fontWeight: 600 }}>View all <i className="fas fa-arrow-right"></i></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: 'var(--border)' }}>
                  {managerSummary.slice(0, 4).map(mgr => (
                    <div key={mgr.name} style={{ background: 'var(--bg)', padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#00AB4E,#007a37)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fas fa-user-tie" style={{ color: '#fff', fontSize: '0.75rem' }}></i>
                        </div>
                        <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.875rem' }}>{mgr.name}</p>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{mgr.actions} total actions</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>Last: {new Date(mgr.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent activity */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem' }}>Recent Activity</h3>
                <button onClick={() => setActiveTab('audit')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#00AB4E', fontSize: '0.8125rem', fontWeight: 600 }}>View all <i className="fas fa-arrow-right"></i></button>
              </div>
              {auditLogs.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {loading ? <><i className="fas fa-spinner fa-spin"></i> Loading…</> : 'No audit logs yet. Actions from the Admin panel will appear here once the audit-log Lambda is deployed.'}
                </div>
              ) : (
                <div>
                  {auditLogs.slice(0, 10).map((log, i) => {
                    const conf = ACTION_CONFIG[log.action] || { label: log.action, icon: 'fa-circle', color: '#374151', bg: '#F3F4F6' };
                    return (
                      <div key={log.id} onClick={() => setSelectedLog(log)} style={{ padding: '0.875rem 1.5rem', borderBottom: i < 9 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`fas ${conf.icon}`} style={{ color: conf.color, fontSize: '0.875rem' }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.875rem', marginBottom: '0.125rem' }}>{conf.label} — <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{log.entityTitle || log.entityId}</span></p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.performedBy} · {new Date(log.timestamp).toLocaleString('en-IN')}</p>
                        </div>
                        <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}></i>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── MANAGERS TAB ── */}
        {activeTab === 'managers' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.25rem' }}>Manager Accounts</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Create, deactivate and manage admin manager accounts.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input value={managerSearch} onChange={e => setManagerSearch(e.target.value)} placeholder="Search by username, name or email…" style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', minWidth: 220 }} />
                <button onClick={() => { setShowCreateManager(true); setManagerFormMsg(''); setShowManagerPassword(false); setManagerForm({ username: '', displayName: '', email: '', role: 'manager', password: '' }); }} style={{ padding: '0.5rem 1rem', background: '#00AB4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                  <i className="fas fa-plus"></i> Create Manager
                </button>
              </div>
            </div>

            {/* Create Manager Modal */}
            {showCreateManager && (
              <div onClick={() => setShowCreateManager(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
                <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 14, padding: '2rem', maxWidth: 440, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
                  <h3 style={{ fontWeight: 800, color: 'var(--text-dark)', marginBottom: '1.25rem' }}>Create New Manager</h3>
                  {(['username', 'displayName', 'email'] as const).map(field => (
                    <div key={field} style={{ marginBottom: '0.875rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'capitalize' }}>{field === 'displayName' ? 'Display Name' : field}</label>
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={managerForm[field]}
                        onChange={e => setManagerForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showManagerPassword ? 'text' : 'password'}
                        value={managerForm.password}
                        onChange={e => setManagerForm(f => ({ ...f, password: e.target.value }))}
                        style={{ width: '100%', padding: '0.625rem 2.5rem 0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', boxSizing: 'border-box' }}
                      />
                      <button type="button" onClick={() => setShowManagerPassword(p => !p)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                        <i className={`fas ${showManagerPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    {managerForm.password && (() => {
                      const p = managerForm.password;
                      let score = 0;
                      if (p.length >= 8) score++;
                      if (/[A-Z]/.test(p)) score++;
                      if (/[0-9]/.test(p)) score++;
                      if (/[^A-Za-z0-9]/.test(p)) score++;
                      const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
                      const colors = ['', '#E53E3E', '#DD6B20', '#D97706', '#38A169'];
                      return (
                        <div style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ height: 4, background: colors[score], borderRadius: 2, width: `${score * 25}%`, transition: 'width 0.2s, background 0.2s' }} />
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: colors[score], minWidth: 40 }}>{labels[score]}</span>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Role</label>
                    <select value={managerForm.role} onChange={e => setManagerForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', boxSizing: 'border-box' }}>
                      <option value="manager">Manager</option>
                      <option value="senior_manager">Senior Manager</option>
                    </select>
                  </div>
                  {managerFormMsg && <p style={{ fontSize: '0.8125rem', color: managerFormMsg.startsWith('✓') ? '#065F46' : '#B91C1C', marginBottom: '0.75rem' }}>{managerFormMsg}</p>}
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={() => setShowCreateManager(false)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: 'var(--text-dark)' }}>Cancel</button>
                    <button disabled={managerFormSaving} onClick={async () => {
                      const { username, displayName, email, role, password } = managerForm;
                      if (!username || !displayName || !email || !password) { setManagerFormMsg('All fields required.'); return; }
                      setManagerFormSaving(true); setManagerFormMsg('');
                      try {
                        const res = await fetch(`${API_BASE}/managers`, { method: 'POST', headers: getMasterHeaders(), body: JSON.stringify({ username, displayName, email, role, password }) });
                        if (res.status === 401) { handleSessionExpired(); return; }
                        const data = await res.json();
                        if (res.ok) { setManagerFormMsg('✓ Manager created!'); fetchManagers(); setTimeout(() => setShowCreateManager(false), 1200); }
                        else setManagerFormMsg(data.error || 'Failed to create manager.');
                      } catch { setManagerFormMsg('Network error.'); }
                      finally { setManagerFormSaving(false); }
                    }} style={{ flex: 1, padding: '0.75rem', background: '#00AB4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: managerFormSaving ? 'not-allowed' : 'pointer', opacity: managerFormSaving ? 0.6 : 1 }}>
                      {managerFormSaving ? 'Creating…' : 'Create Manager'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {managersError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1rem', color: '#B91C1C', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-exclamation-circle"></i> {managersError}
              </div>
            )}

            {managersLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin"></i> Loading…</div>
            ) : filteredManagers.length === 0 ? (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {managerSearch ? `No managers match "${managerSearch}".` : 'No manager accounts yet. Click "Create Manager" to add the first one.'}
              </div>
            ) : (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        {['Username', 'Display Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredManagers.map((mgr, i) => (
                        <tr key={mgr.managerId} style={{ borderBottom: i < filteredManagers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{mgr.username}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-dark)' }}>{mgr.displayName}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{mgr.email}</td>
                          <td style={{ padding: '0.875rem 1rem' }}><span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 20, fontWeight: 600, background: mgr.role === 'senior_manager' ? '#DBEAFE' : '#F3F4F6', color: mgr.role === 'senior_manager' ? '#1E40AF' : '#374151' }}>{mgr.role === 'senior_manager' ? 'Senior Manager' : 'Manager'}</span></td>
                          <td style={{ padding: '0.875rem 1rem' }}><span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 20, fontWeight: 600, background: mgr.status === 'active' ? '#D1FAE5' : '#FEE2E2', color: mgr.status === 'active' ? '#065F46' : '#991B1B' }}>{mgr.status}</span></td>
                          <td style={{ padding: '0.875rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{mgr.lastLoginAt ? new Date(mgr.lastLoginAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {mgr.status === 'active' ? (
                                <button onClick={() => setConfirmManagerAction({ managerId: mgr.managerId, newStatus: 'deactivated', displayName: mgr.displayName })} style={{ padding: '0.3rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Deactivate</button>
                              ) : (
                                <button onClick={() => setConfirmManagerAction({ managerId: mgr.managerId, newStatus: 'active', displayName: mgr.displayName })} style={{ padding: '0.3rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Reactivate</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── AUDIT LOG TAB ── */}
        {activeTab === 'audit' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)' }}>Audit Log</h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search by title, ID or manager…" style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', minWidth: 200 }} />
                <select value={auditFilter} onChange={e => setAuditFilter(e.target.value)} style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)' }}>
                  <option value="all">All Actions</option>
                  <option value="faq">FAQ</option>
                  <option value="ticket">Tickets</option>
                  <option value="CREATE_FAQ">Created FAQ</option>
                  <option value="UPDATE_FAQ">Updated FAQ</option>
                  <option value="DELETE_FAQ">Deleted FAQ</option>
                  <option value="UPDATE_TICKET">Updated Ticket</option>
                  <option value="CREATE_TICKET">Created Ticket</option>
                  <option value="LOGIN">Admin Login</option>
                </select>
                <button onClick={() => exportCSV(auditLogs as unknown as Record<string, unknown>[], 'audit-log.csv')} style={{ padding: '0.5rem 0.875rem', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-download"></i> Export CSV
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {filteredLogs.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {loading
                    ? <><i className="fas fa-spinner fa-spin"></i> Loading…</>
                    : auditSearch || auditFilter !== 'all'
                      ? `No logs match your filter. Try clearing the search or selecting "All Actions".`
                      : <><p style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-dark)' }}>No audit logs yet.</p><p>Once the <code>ib-audit-log</code> DynamoDB table is created and the updated Lambda is deployed, every manager action will appear here automatically.</p></>
                  }
                </div>
              ) : (
                filteredLogs.map((log, i) => {
                  const conf = ACTION_CONFIG[log.action] || { label: log.action, icon: 'fa-circle', color: '#374151', bg: '#F3F4F6' };
                  return (
                    <div key={log.id} onClick={() => setSelectedLog(log)} style={{ padding: '0.875rem 1.5rem', borderBottom: i < filteredLogs.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: conf.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fas ${conf.icon}`} style={{ color: conf.color, fontSize: '0.875rem' }}></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 20, fontWeight: 600, background: conf.bg, color: conf.color }}>{conf.label}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.entityId}</span>
                        </div>
                        <p style={{ fontWeight: 500, color: 'var(--text-dark)', fontSize: '0.875rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{log.entityTitle || '—'}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString('en-IN')}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.performedBy}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)' }}>Public Portal Analytics</h2>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <select value={analyticsDays} onChange={e => { const d = Number(e.target.value); setAnalyticsDays(d); fetchAnalytics(d); }} style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)' }}>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
                <button onClick={() => fetchAnalytics(analyticsDays)} disabled={analyticsLoading} style={{ padding: '0.5rem 0.875rem', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className={`fas fa-sync-alt ${analyticsLoading ? 'fa-spin' : ''}`}></i> Refresh
                </button>
                {analytics && (
                  <button onClick={() => {
                    const rows = [
                      { metric: 'Article Views', value: analytics.article_views },
                      { metric: 'Searches', value: analytics.searches },
                      { metric: 'Chatbot Opens', value: analytics.chatbot_opens },
                      { metric: 'Chatbot Messages', value: analytics.chatbot_messages },
                      { metric: 'Tickets Submitted', value: analytics.ticket_submits },
                      { metric: 'Helpful Feedback', value: analytics.faq_feedback_helpful },
                      { metric: 'Not Helpful Feedback', value: analytics.faq_feedback_not_helpful },
                    ];
                    exportCSV(rows as unknown as Record<string, unknown>[], `analytics-${analyticsDays}d.csv`);
                  }} style={{ padding: '0.5rem 0.875rem', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <i className="fas fa-download"></i> Export CSV
                  </button>
                )}
              </div>
            </div>
            {analyticsLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem' }}></i></div>
            ) : !analytics ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No analytics data yet. Events are tracked as users visit the portal.</div>
            ) : (
              <>
                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Article Views',    value: analytics.article_views,    icon: 'fa-eye',            color: '#00AB4E', bg: '#D1FAE5' },
                    { label: 'Searches',          value: analytics.searches,          icon: 'fa-search',         color: '#1E40AF', bg: '#DBEAFE' },
                    { label: 'Chatbot Opens',     value: analytics.chatbot_opens,     icon: 'fa-comment-dots',   color: '#5B21B6', bg: '#EDE9FE' },
                    { label: 'Chatbot Messages',  value: analytics.chatbot_messages,  icon: 'fa-paper-plane',    color: '#92400E', bg: '#FEF3C7' },
                    { label: 'Tickets Submitted', value: analytics.ticket_submits,    icon: 'fa-ticket-alt',     color: '#991B1B', bg: '#FEE2E2' },
                    { label: 'Helpful Feedback',  value: analytics.faq_feedback_helpful, icon: 'fa-thumbs-up',  color: '#065F46', bg: '#D1FAE5' },
                    { label: 'Not Helpful',       value: analytics.faq_feedback_not_helpful, icon: 'fa-thumbs-down', color: '#374151', bg: '#F3F4F6' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={`fas ${kpi.icon}`} style={{ color: kpi.color, fontSize: '1rem' }}></i>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{kpi.label}</p>
                        <p style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>{kpi.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {/* Top Articles */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem', marginBottom: '1rem' }}>Top Articles by Views</h3>
                    {analytics.top_articles.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p> : analytics.top_articles.map(([title, count]) => (
                      <div key={title} style={{ marginBottom: '0.625rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{title}</span>
                          <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '0.5rem' }}>{count}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2 }}>
                          <div style={{ height: 4, background: '#00AB4E', borderRadius: 2, width: `${Math.round((count / (analytics.top_articles[0]?.[1] || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top Searches */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem', marginBottom: '1rem' }}>Top Search Terms</h3>
                    {analytics.top_searches.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p> : analytics.top_searches.slice(0, 10).map(([term, count]) => (
                      <div key={term} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-dark)' }}>{term}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                      </div>
                    ))}
                  </div>

                  {/* Chatbot Personas */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem', marginBottom: '1rem' }}>Chatbot Persona Usage</h3>
                    {Object.keys(analytics.persona_counts).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p> : Object.entries(analytics.persona_counts).map(([persona, count]) => (
                      <div key={persona} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                        <span style={{ color: 'var(--text-dark)', textTransform: 'capitalize' }}>{persona}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{count}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tickets by Category */}
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                    <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9375rem', marginBottom: '1rem' }}>Tickets by Category</h3>
                    {Object.keys(analytics.tickets_by_category).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet.</p> : Object.entries(analytics.tickets_by_category).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                      <div key={cat} style={{ marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-dark)' }}>{cat}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2 }}>
                          <div style={{ height: 4, background: '#5B21B6', borderRadius: 2, width: `${Math.round((count / Math.max(...Object.values(analytics.tickets_by_category))) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── TICKETS TAB ── */}
        {activeTab === 'tickets' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)' }}>All Tickets <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '1rem' }}>({filteredTickets.length})</span></h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} placeholder="Search by subject, email or ID…" style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', minWidth: 200 }} />
                <select value={ticketFilter} onChange={e => setTicketFilter(e.target.value)} style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)' }}>
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="solved">Solved / Resolved</option>
                </select>
                <button onClick={() => exportCSV(tickets as unknown as Record<string, unknown>[], 'tickets.csv')} style={{ padding: '0.5rem 0.875rem', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-download"></i> Export CSV
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin"></i> Loading tickets…</div>
              ) : filteredTickets.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No tickets found.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        {['Ticket ID', 'Subject', 'Customer', 'Category', 'Status', 'Date'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map((t, i) => {
                        // Normalise legacy 'resolved' to 'solved' for display
                        const normStatus = (t.status === 'resolved' ? 'solved' : t.status) as keyof typeof STATUS_CONFIG;
                        const sc = STATUS_CONFIG[normStatus] || STATUS_CONFIG.open;
                        // Guard against invalid dates
                        const dateStr = t.createdAt && !isNaN(new Date(t.createdAt).getTime())
                          ? new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';
                        return (
                          <tr key={t.id} style={{ borderBottom: i < filteredTickets.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.id}</td>
                            <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: 'var(--text-dark)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject || '—'}</td>
                            <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                              <p style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{t.name || '—'}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.email || '—'}</p>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t.category || '—'}</td>
                            <td style={{ padding: '0.875rem 1rem' }}>
                              <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 20, fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>{sc.label}</span>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{dateStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── FAQ TAB ── */}
        {activeTab === 'faq' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-dark)' }}>FAQ Articles <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '1rem' }}>({filteredArticles.length}{faqSearch ? ` of ${articles.length}` : ''})</span></h2>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input value={faqSearch} onChange={e => setFaqSearch(e.target.value)} placeholder="Search articles…" style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', background: 'var(--bg)', color: 'var(--text-dark)', minWidth: 180 }} />
                <button onClick={() => exportCSV(articles as unknown as Record<string, unknown>[], 'faq-articles.csv')} style={{ padding: '0.5rem 0.875rem', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-download"></i> Export CSV
                </button>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin"></i> Loading articles…</div>
              ) : filteredArticles.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {faqSearch ? `No articles match "${faqSearch}". Try a different search.` : 'No FAQ articles found.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        {['ID', 'Title', 'Category', 'Status'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArticles.map((a, i) => (
                        <tr key={a.id} style={{ borderBottom: i < filteredArticles.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '0.875rem 1rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.id}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 500, color: 'var(--text-dark)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || '—'}</td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)' }}>{a.category || '—'}</td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 20, fontWeight: 600, background: a.status === 'published' || !a.status ? '#D1FAE5' : '#F3F4F6', color: a.status === 'published' || !a.status ? '#065F46' : '#374151' }}>{a.status || 'published'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Confirm manager status change modal ── */}
      {confirmManagerAction && (
        <div onClick={() => setConfirmManagerAction(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 14, padding: '2rem', maxWidth: 380, width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: confirmManagerAction.newStatus === 'deactivated' ? '#FEE2E2' : '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '1.25rem', color: confirmManagerAction.newStatus === 'deactivated' ? '#991B1B' : '#065F46' }}>
              <i className={`fas ${confirmManagerAction.newStatus === 'deactivated' ? 'fa-user-slash' : 'fa-user-check'}`}></i>
            </div>
            <h3 style={{ fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>{confirmManagerAction.newStatus === 'deactivated' ? 'Deactivate Manager?' : 'Reactivate Manager?'}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {confirmManagerAction.newStatus === 'deactivated'
                ? `${confirmManagerAction.displayName} will lose access to the admin portal immediately.`
                : `${confirmManagerAction.displayName} will regain access to the admin portal.`}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmManagerAction(null)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1.5px solid var(--border)', borderRadius: 8, fontWeight: 600, cursor: 'pointer', color: 'var(--text-dark)' }}>Cancel</button>
              <button onClick={async () => {
                const { managerId, newStatus } = confirmManagerAction;
                setConfirmManagerAction(null);
                const r = await fetch(`${API_BASE}/managers/${managerId}`, { method: 'PUT', headers: getMasterHeaders(), body: JSON.stringify({ status: newStatus }) });
                if (r.status === 401) { handleSessionExpired(); return; }
                fetchManagers();
              }} style={{ flex: 1, padding: '0.75rem', background: confirmManagerAction.newStatus === 'deactivated' ? '#991B1B' : '#00AB4E', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {confirmManagerAction.newStatus === 'deactivated' ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Audit detail modal ── */}
      {selectedLog && (
        <div onClick={() => setSelectedLog(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: 14, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 500, width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '1.125rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-subtle)' }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1rem' }}>Audit Entry Detail</h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', lineHeight: 1 }}><i className="fas fa-times"></i></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              {[
                ['Log ID', selectedLog.id],
                ['Action', ACTION_CONFIG[selectedLog.action]?.label || selectedLog.action],
                ['Entity Type', selectedLog.entity],
                ['Entity ID', selectedLog.entityId],
                ['Title / Subject', selectedLog.entityTitle || '—'],
                ['Performed By', selectedLog.performedBy],
                ['Timestamp', new Date(selectedLog.timestamp).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: '0.1rem' }}>{label}</span>
                  <span style={{ color: 'var(--text-dark)', fontWeight: 500, wordBreak: 'break-all' }}>{String(value)}</span>
                </div>
              ))}
              {selectedLog.meta && Object.keys(selectedLog.meta).length > 0 && (
                <div>
                  <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Metadata</p>
                  <pre style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.875rem', fontSize: '0.8rem', color: 'var(--text-dark)', overflowX: 'auto', margin: 0 }}>{JSON.stringify(selectedLog.meta, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
