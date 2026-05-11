'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Article {
  id: string;
  title: string;
  category: string;
  content?: string;
  status?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  sortOrder?: number;
  status?: string;
}

function normalise(s: string) {
  return s?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || '';
}

const CAT_PALETTE = [
  { bg: '#E6FAE6', color: '#00AB4E' },
  { bg: '#EFF6FF', color: '#3B82F6' },
  { bg: '#FFF7ED', color: '#F97316' },
  { bg: '#FAF5FF', color: '#A855F7' },
  { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#FFF1F2', color: '#F43F5E' },
  { bg: '#ECFDF5', color: '#10B981' },
  { bg: '#FFFBEB', color: '#F59E0B' },
  { bg: '#F0F9FF', color: '#0284C7' },
  { bg: '#EEF2FF', color: '#6366F1' },
  { bg: '#F5F3FF', color: '#8B5CF6' },
  { bg: '#F0FDF4', color: '#22C55E' },
  { bg: '#F8FAFC', color: '#64748B' },
  { bg: '#FFF9C4', color: '#CA8A04' },
  { bg: '#F1F5F9', color: '#0F172A' },
  { bg: '#ECFEFF', color: '#06B6D4' },
];

const STATIC_CATEGORIES: Category[] = [
  { id: 'getting-started', name: 'Getting Started',     icon: 'fas fa-rocket',               parentId: null },
  { id: 'account-opening', name: 'Account Opening',     icon: 'fas fa-id-card',              parentId: null },
  { id: 'trading',         name: 'Trading',             icon: 'fas fa-chart-line',           parentId: null },
  { id: 'portfolio',       name: 'Portfolio & Margin',  icon: 'fas fa-briefcase',            parentId: null },
  { id: 'funds',           name: 'Funds',               icon: 'fas fa-wallet',               parentId: null },
  { id: 'charges',         name: 'Charges & Brokerage', icon: 'fas fa-tags',                 parentId: null },
  { id: 'compliance',      name: 'Compliance & Safety', icon: 'fas fa-shield-halved',        parentId: null },
  { id: 'mutual-funds',    name: 'Mutual Funds',        icon: 'fas fa-seedling',             parentId: null },
  { id: 'ipo',             name: 'IPO',                 icon: 'fas fa-rocket',               parentId: null },
  { id: 'fo',              name: 'F&O',                 icon: 'fas fa-bolt',                 parentId: null },
  { id: 'pledging',        name: 'Pledging',            icon: 'fas fa-link',                 parentId: null },
  { id: 'mtf',             name: 'MTF',                 icon: 'fas fa-layer-group',          parentId: null },
  { id: 'tender-offers',   name: 'Tender Offers',       icon: 'fas fa-hand-holding-dollar',  parentId: null },
  { id: 'contact-faq',     name: 'Contact & Help',      icon: 'fas fa-headset',              parentId: null },
  { id: 'advanced',        name: 'Advanced',            icon: 'fas fa-robot',                parentId: null },
  { id: 'account',         name: 'Account',             icon: 'fas fa-user-circle',          parentId: null },
  { id: 'reports',         name: 'Reports',             icon: 'fas fa-file-invoice',         parentId: null },
  { id: 'nri',             name: 'NRI / HUF Accounts',  icon: 'fas fa-globe',                parentId: null },
];

function PopularArticleRow({ article }: { article: Article }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="article-row" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default', padding: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '1rem 1.25rem', textAlign: 'left' }}
      >
        <div className="article-row-text">
          <h4>{article.title}</h4>
          <span>{article.category}</span>
        </div>
        <i className={`fas fa-chevron-${open ? 'down' : 'right'}`} style={{ flexShrink: 0, marginLeft: '1rem', transition: 'transform 0.2s' }}></i>
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)', marginTop: 0 }}>
          <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-mid)', marginTop: '1rem' }}>
            {article.content || 'Visit the FAQ section for full details on this topic.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [popularArticles, setPopularArticles] = useState<Article[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularError, setPopularError] = useState(false);

  const [homeCategories, setHomeCategories] = useState<Category[]>(STATIC_CATEGORIES);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allArticlesRef = useRef<Article[]>([]);

  useEffect(() => {
    if (!API_BASE) return;
    fetch(`${API_BASE}/categories`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: Category[]) => {
        const dbTopLevel = (data as Category[]).filter(c => (!c.status || c.status === 'active') && !c.parentId);
        // 1. Start with the full static list — replace entries that exist in DB (preserves DB id/icon)
        const merged: Category[] = STATIC_CATEGORIES.map(s => {
          const dbMatch = dbTopLevel.find(d => d.name.toLowerCase() === s.name.toLowerCase());
          return dbMatch || s;
        });
        // 2. Append any NEW top-level categories admins created that aren't in the static list
        dbTopLevel.forEach(d => {
          if (!STATIC_CATEGORIES.some(s => s.name.toLowerCase() === d.name.toLowerCase())) {
            merged.push(d);
          }
        });
        setHomeCategories(merged);
      })
      .catch(() => {/* keep static fallback — all 18 always visible */});
  }, []);

  // Fetch all published articles once — used for both popular section and search
  const fetchArticles = useCallback(async () => {
    if (!API_BASE) { setPopularLoading(false); setPopularError(true); return; }
    setPopularLoading(true);
    setPopularError(false);
    try {
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      const published = items.filter(a => !a.status || a.status === 'published');
      allArticlesRef.current = published;
      // Show up to 8 most recent published articles as "popular"
      setPopularArticles(published.slice(0, 8));
      setPopularError(false);
    } catch {
      setPopularError(true);
    } finally {
      setPopularLoading(false);
    }
  }, []);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const performSearch = (q: string) => {
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    const ql = q.toLowerCase();
    setSearchLoading(true);
    const articles = allArticlesRef.current;
    const filtered = articles.filter(a =>
      a.title?.toLowerCase().includes(ql) || a.category?.toLowerCase().includes(ql) || a.content?.toLowerCase().includes(ql)
    ).slice(0, 8);
    setResults(filtered);
    setShowDropdown(filtered.length > 0);
    setSearchLoading(false);
  };

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 300);
  };

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <h1>How can we help you?</h1>
        <div className="search-wrapper">
          <i className="fas fa-search search-icon"></i>
          <input
            id="globalSearch"
            type="text"
            className="search-input"
            placeholder="Search for orders, GTT, funds, IPO, charges…"
            autoComplete="off"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            aria-label="Search help articles"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
          />
          {showDropdown && results.length > 0 && (
            <div id="searchResults" className="search-results-dropdown active" role="listbox">
              {results.map((article, i) => (
                <Link
                  key={i}
                  href={`/faq/?q=${encodeURIComponent(article.title)}`}
                  className="search-result-item"
                  role="option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }}
                >
                  <div className="search-result-icon" style={{ background: 'var(--bg-subtle)' }}>
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div className="search-result-info">
                    <h4>{article.title}</h4>
                    <p>{article.category}</p>
                  </div>
                </Link>
              ))}
              <Link
                href={`/faq/?q=${encodeURIComponent(query)}`}
                className="search-result-item"
                style={{ borderTop: '1px solid var(--border)', justifyContent: 'center', color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }}
              >
                <i className="fas fa-search" style={{ marginRight: '0.5rem' }}></i>
                View all results for &ldquo;{query}&rdquo;
              </Link>
            </div>
          )}
          {searchLoading && <div id="searchResults" className="search-results-dropdown"></div>}
          {!showDropdown && !searchLoading && <div id="searchResults" className="search-results-dropdown"></div>}
        </div>
        <p className="hero-meta">
          Popular:{' '}
          <Link href="/faq?cat=trading">GTT</Link> ·{' '}
          <Link href="/faq?cat=funds">Add Funds</Link> ·{' '}
          <Link href="/faq?cat=getting-started">Open Account</Link> ·{' '}
          <Link href="/faq?cat=charges">Brokerage</Link> ·{' '}
          <Link href="/faq?cat=compliance">TPIN / eDIS</Link> ·{' '}
          <Link href="/faq?cat=mutual-funds">SIP Setup</Link>
        </p>
      </div>

      {/* MAIN */}
      <main className="container">

        {/* CATEGORIES — dynamic from DB, falls back to static list */}
        <div className="section">
          <p className="section-title">Browse by topic</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '4rem' }}>
            {homeCategories.map((cat, idx) => {
              const palette = CAT_PALETTE[idx % CAT_PALETTE.length];
              const slug = normalise(cat.name);
              const href = `/faq?cat=${cat.id !== slug ? cat.id : slug}`;
              return (
                <Link
                  key={cat.id}
                  href={href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '1.75rem 1.25rem',
                    background: 'var(--bg, #fff)',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
                >
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.35rem', marginBottom: '1rem', flexShrink: 0,
                    background: palette.bg, color: palette.color,
                  }}>
                    <i className={cat.icon || 'fas fa-folder'}></i>
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark, #111)', marginBottom: '0.35rem', margin: '0 0 0.35rem' }}>{cat.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b7280)', lineHeight: 1.4, margin: 0 }}>
                    {cat.id === 'getting-started' ? 'Account, KYC, first trade' :
                     cat.id === 'account-opening' ? 'KYC, documents, activation' :
                     cat.id === 'trading' ? 'Orders, GTT, Basket, AMO' :
                     cat.id === 'portfolio' ? 'P&L, Holdings, Pledge, MTF' :
                     cat.id === 'funds' ? 'Add, withdraw, ledger' :
                     cat.id === 'charges' ? 'STT, GST, DP, brokerage plans' :
                     cat.id === 'compliance' ? 'TPIN, eDIS, ASM/GSM, 2FA' :
                     cat.id === 'mutual-funds' ? 'SIP, lump sum, ELSS, redemption' :
                     cat.id === 'ipo' ? 'Apply, allotment, listing' :
                     cat.id === 'fo' ? 'Futures, options, margins, expiry' :
                     cat.id === 'pledging' ? 'Collateral margin, haircut' :
                     cat.id === 'mtf' ? 'Margin Trading Facility' :
                     cat.id === 'tender-offers' ? 'Buybacks, OFS, delisting' :
                     cat.id === 'contact-faq' ? 'Support desk, escalation' :
                     cat.id === 'advanced' ? 'Algo, Smallcase, Webhooks' :
                     cat.id === 'account' ? 'Profile, security, segments' :
                     cat.id === 'reports' ? 'Tax P&L, contract notes' :
                     cat.id === 'nri' ? 'NRE/NRO, PIS, repatriation' :
                     'Browse articles'}
                  </p>
                </Link>
              );
            })}
            <Link
              href="/contact"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                padding: '1.75rem 1.25rem', background: 'var(--bg, #fff)',
                border: '1px solid var(--border, #e5e7eb)', borderRadius: '16px',
                textDecoration: 'none', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
            >
              <div style={{ width: '52px', height: '52px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', marginBottom: '1rem', background: '#FFF9C4', color: '#CA8A04' }}>
                <i className="fas fa-headset"></i>
              </div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark, #111)', margin: '0 0 0.35rem' }}>Contact Us</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #6b7280)', lineHeight: 1.4, margin: 0 }}>Chat, call, raise ticket</p>
            </Link>
          </div>
        </div>

        {/* POPULAR ARTICLES — live from API */}
        <div className="section">
          <p className="section-title">Popular articles</p>
          {popularLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i> Loading articles…
            </div>
          ) : popularError ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <i className="fas fa-circle-exclamation" style={{ marginRight: '0.5rem', color: '#F59E0B' }}></i>
              Help articles are temporarily unavailable. For urgent assistance call{' '}
              <a href="tel:02261446300" style={{ color: 'var(--accent)', fontWeight: 600 }}>022-61446300</a>{' '}
              or email{' '}
              <a href="mailto:helpdesk@indiabullssecurities.com" style={{ color: 'var(--accent)', fontWeight: 600 }}>helpdesk@indiabullssecurities.com</a>
              <br /><br />
              <button onClick={fetchArticles} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
                <i className="fas fa-rotate-right" style={{ marginRight: '0.4rem' }}></i>Try again
              </button>
            </div>
          ) : popularArticles.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
              No articles published yet. Check back soon.
            </div>
          ) : (
            <div className="article-list">
              {popularArticles.map((article) => (
                <PopularArticleRow key={article.id} article={article} />
              ))}
              {allArticlesRef.current.length > 8 && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <Link href="/faq" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}>
                    View all {allArticlesRef.current.length} articles <i className="fas fa-arrow-right" style={{ marginLeft: '0.25rem' }}></i>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTACT STRIP */}
        <div className="contact-strip">
          <div>
            <h3>Still need help?</h3>
            <p>Support team available <strong>Mon–Sat, 8 AM – 8 PM IST</strong> across chat, phone and email.</p>
          </div>
          <div className="contact-actions">
            <Link href="/contact" className="btn-primary"><i className="fas fa-comment-dots"></i> Start a Chat</Link>
            <a href="tel:02261446300" className="btn-secondary"><i className="fas fa-phone"></i> Call Us</a>
            <Link href="/my-tickets" className="btn-secondary"><i className="fas fa-ticket"></i> My Tickets</Link>
          </div>
        </div>


      </main>
    </>
  );
}
