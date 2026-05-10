'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Article {
  id: string;
  title: string;
  question?: string;
  content: string;
  answer?: string;
  category: string;
  status?: string;
}

const VALID_CATEGORIES = [
  'getting-started','account-opening','trading','portfolio','funds','ipo',
  'fo','pledging','account','reports','contact-faq','mtf','tender-offers',
  'kyc','charges','compliance','mutual-funds','nri','advanced','all',
];

// Labels MUST exactly match the category strings stored in DynamoDB.
// The matching logic in FAQContent uses label equality — any mismatch means
// articles in that category never appear when the sidebar filter is active.
const CATEGORIES = [
  { key: 'all',            label: 'All Topics',            icon: 'fas fa-border-all' },
  { key: 'getting-started',label: 'Getting Started',       icon: 'fas fa-rocket' },
  { key: 'account-opening',label: 'Account Opening',       icon: 'fas fa-id-card' },
  { key: 'trading',        label: 'Trading',               icon: 'fas fa-chart-line' },
  { key: 'portfolio',      label: 'Portfolio & Margin',    icon: 'fas fa-briefcase' },
  { key: 'funds',          label: 'Funds',                 icon: 'fas fa-wallet' },
  { key: 'ipo',            label: 'IPO',                   icon: 'fas fa-rocket' },
  { key: 'fo',             label: 'F&O',                   icon: 'fas fa-bolt' },
  { key: 'pledging',       label: 'Pledging',              icon: 'fas fa-link' },
  { key: 'account',        label: 'Account',               icon: 'fas fa-user-circle' },
  { key: 'reports',        label: 'Reports',               icon: 'fas fa-file-invoice' },
  { key: 'contact-faq',    label: 'Contact & Help',        icon: 'fas fa-headset' },
  { key: 'mtf',            label: 'MTF',                   icon: 'fas fa-layer-group' },
  { key: 'tender-offers',  label: 'Tender Offers',         icon: 'fas fa-hand-holding-dollar' },
  { key: 'charges',        label: 'Charges & Brokerage',   icon: 'fas fa-tags' },
  { key: 'compliance',     label: 'Compliance & Safety',   icon: 'fas fa-shield-halved' },
  { key: 'mutual-funds',   label: 'Mutual Funds',          icon: 'fas fa-seedling' },
  { key: 'nri',            label: 'NRI/HUF Accounts',      icon: 'fas fa-globe' },
  { key: 'advanced',       label: 'Advanced',              icon: 'fas fa-robot' },
];

function FAQContent() {
  const searchParams = useSearchParams();
  const rawCat = searchParams.get('cat') || 'all';
  const catParam = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [selectedCat, setSelectedCat] = useState(catParam);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackGivenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const validated = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';
    setSelectedCat(validated);
  }, [rawCat]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setApiError(false);

    const attempt = async () => {
      if (!API_BASE) throw new Error('No API configured');
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    try {
      let data;
      try {
        data = await attempt();
      } catch {
        await new Promise(r => setTimeout(r, 1000));
        data = await attempt();
      }
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      const published = items.filter((a) => !a.status || a.status === 'published' || a.status === 'active' || a.status === 'approved');
      setArticles(published);
      setApiError(false);
    } catch {
      setApiError(true);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const catKeyToLabel: Record<string, string> = Object.fromEntries(
    CATEGORIES.map(c => [c.key, c.label])
  );

  const filtered = articles.filter((a) => {
    const artCatNorm = a.category?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const matchesCat = selectedCat === 'all' ||
      artCatNorm === selectedCat ||
      a.category?.toLowerCase() === (catKeyToLabel[selectedCat] || selectedCat).toLowerCase();
    const matchesSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      (a.content || a.answer || '')?.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const grouped: Record<string, Article[]> = filtered.reduce<Record<string, Article[]>>((acc: Record<string, Article[]>, a: Article) => {
    const cat = a.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const getCount = (key: string) => {
    if (key === 'all') return articles.length;
    const label = (catKeyToLabel[key] || key).toLowerCase();
    return articles.filter(a => {
      const artCatNorm = a.category?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return artCatNorm === key || a.category?.toLowerCase() === label;
    }).length;
  };

  const heading = selectedCat === 'all'
    ? 'All Topics'
    : CATEGORIES.find(c => c.key === selectedCat)?.label || selectedCat;

  return (
    <div className="kb-layout">

      {/* SIDEBAR */}
      <aside className="kb-sidebar">
        <p className="kb-sidebar-title">Topics</p>
        <div className="kb-sidebar-nav" id="kbSidebar">
          {CATEGORIES.slice(0, 15).map((cat) => {
            const count = getCount(cat.key);
            return (
              <button
                key={cat.key}
                className={`kb-nav-link${selectedCat === cat.key ? ' active' : ''}`}
                onClick={() => { setSelectedCat(cat.key); setSearch(''); }}
              >
                <i className={cat.icon} style={{ width: '14px' }}></i>
                {cat.label}
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}

          <p className="kb-sidebar-title" style={{ marginTop: '0.75rem' }}>More Topics</p>
          {CATEGORIES.slice(15).map((cat) => {
            const count = getCount(cat.key);
            return (
              <button
                key={cat.key}
                className={`kb-nav-link${selectedCat === cat.key ? ' active' : ''}`}
                onClick={() => { setSelectedCat(cat.key); setSearch(''); }}
              >
                <i className={cat.icon} style={{ width: '14px' }}></i>
                {cat.label}
                {count > 0 && <span className="nav-count">{count}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>Still stuck?</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Our team replies within 2 hours.</p>
          <Link href="/contact" className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
            <i className="fas fa-comment-dots"></i> Contact Support
          </Link>
        </div>

        <div style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            Regulatory Links
          </p>
          {[
            { href: 'https://www.sebi.gov.in', label: 'SEBI' },
            { href: 'https://www.nseindia.com', label: 'NSE India' },
            { href: 'https://www.bseindia.com', label: 'BSE India' },
            { href: 'https://www.cdslindia.com', label: 'CDSL' },
            { href: 'https://scores.sebi.gov.in', label: 'SCORES Grievance' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-mid)', padding: '0.3rem 0', textDecoration: 'none' }}
            >
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.6rem' }}></i> {link.label}
            </a>
          ))}
        </div>
      </aside>

      {/* MAIN ARTICLES */}
      <main className="kb-main">
        {apiError && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#92400E', margin: 0 }}>
              <i className="fas fa-circle-exclamation" style={{ marginRight: '0.5rem', color: '#F59E0B' }}></i>
              <strong>Help articles are temporarily unavailable.</strong> For urgent assistance call{' '}
              <a href="tel:02261446300" style={{ color: '#92400E', fontWeight: 700 }}>022-61446300</a> or email{' '}
              <a href="mailto:helpdesk@indiabullssecurities.com" style={{ color: '#92400E', fontWeight: 700 }}>helpdesk@indiabullssecurities.com</a>.{' '}
              <button onClick={fetchArticles} style={{ background: 'none', border: 'none', color: '#92400E', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', padding: 0, fontWeight: 600 }}>Retry</button>
            </p>
          </div>
        )}

        <div className="notice-banner">
          <i className="fas fa-shield-halved"></i>
          <span><strong>Verified content:</strong> All articles are cross-referenced with official Indiabulls Securities policies.</span>
        </div>

        <div className="kb-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 id="kbHeading">{heading}</h1>
              <p id="kbSubheading">
                {selectedCat === 'all'
                  ? 'Browse all support articles or filter by topic from the sidebar.'
                  : `${filtered.length} article${filtered.length !== 1 ? 's' : ''} in this topic.`}
              </p>
            </div>
            <div className="search-wrapper" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
              <i className="fas fa-search search-icon"></i>
              <input
                id="faqSearch"
                type="text"
                className="search-input"
                placeholder="Search Knowledge Base..."
                autoComplete="off"
                maxLength={200}
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  if (val.length >= 2) {
                    searchDebounceRef.current = setTimeout(() => {
                      trackEvent({ eventType: 'search', searchTerm: val, searchResultCount: filtered.length });
                    }, 800);
                  }
                }}
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
        </div>

        <div id="articleContainer">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading articles...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-search" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}></i>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No articles found{search ? ` for "${search}"` : ` in ${heading}`}</p>
              {search && (
                <button onClick={() => setSearch('')} className="btn-secondary" style={{ marginRight: '0.75rem' }}>
                  Clear Search
                </button>
              )}
              <Link href="/contact" className="btn-primary">Contact Support</Link>
            </div>
          ) : (
            (Object.entries(grouped) as [string, Article[]][]).map(([cat, items]) => (
              <div key={cat} className="article-group" data-cat={cat.toLowerCase()}>
                <p className="article-group-title">{cat}</p>
                {items.map((article: Article) => (
                  <div key={article.id} className="article-card" id={article.id}>
                    <button
                      className={`article-trigger${openId === article.id ? ' open' : ''}`}
                      onClick={() => {
                        const isOpening = openId !== article.id;
                        setOpenId(isOpening ? article.id : null);
                        if (isOpening) {
                          trackEvent({ eventType: 'article_view', articleId: article.id, articleTitle: article.title || article.question, category: article.category });
                        }
                      }}
                    >
                      <div className="article-trigger-left">
                        <span className="article-cat-dot"></span>
                        <div>
                          <h3>{article.title || article.question || 'Untitled'}</h3>
                          <p>{article.category}</p>
                        </div>
                      </div>
                      <i className="fas fa-chevron-down article-chevron"></i>
                    </button>
                    <div className={`article-body${openId === article.id ? ' open' : ''}`}>
                      <p style={{ whiteSpace: 'pre-line' }}>{article.content || article.answer || ''}</p>
                      <div className="article-feedback">
                        <span>Was this helpful?</span>
                        <div className="feedback-buttons">
                          <button
                            className="feedback-btn"
                            data-type="yes"
                            onClick={() => {
                              if (feedbackGivenRef.current.has(article.id)) return;
                              feedbackGivenRef.current.add(article.id);
                              trackEvent({ eventType: 'faq_feedback', articleId: article.id, articleTitle: article.title || article.question, category: article.category, feedbackType: 'helpful' });
                            }}
                          >
                            <i className="far fa-thumbs-up"></i> Yes
                          </button>
                          <button
                            className="feedback-btn"
                            data-type="no"
                            onClick={() => {
                              if (feedbackGivenRef.current.has(article.id)) return;
                              feedbackGivenRef.current.add(article.id);
                              trackEvent({ eventType: 'faq_feedback', articleId: article.id, articleTitle: article.title || article.question, category: article.category, feedbackType: 'not_helpful' });
                            }}
                          >
                            <i className="far fa-thumbs-down"></i> No
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default function FAQPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '8rem 0' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    }>
      <FAQContent />
    </Suspense>
  );
}
