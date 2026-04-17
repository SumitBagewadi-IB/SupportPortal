'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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

const CATEGORIES = [
  { key: 'all', label: 'All Topics', icon: 'fas fa-border-all', countId: 'count-all' },
  { key: 'getting-started', label: 'Getting Started', icon: 'fas fa-rocket', countId: 'count-gs' },
  { key: 'account-opening', label: 'Account Opening', icon: 'fas fa-id-card', countId: 'count-ao' },
  { key: 'trading', label: 'Trading', icon: 'fas fa-chart-line', countId: 'count-tr' },
  { key: 'portfolio', label: 'Portfolio', icon: 'fas fa-briefcase', countId: 'count-pf' },
  { key: 'funds', label: 'Funds', icon: 'fas fa-wallet', countId: 'count-fn' },
  { key: 'ipo', label: 'IPO', icon: 'fas fa-rocket', countId: 'count-ipo' },
  { key: 'fo', label: 'F&O', icon: 'fas fa-bolt', countId: 'count-fo' },
  { key: 'pledging', label: 'Pledging', icon: 'fas fa-link', countId: 'count-pledge' },
  { key: 'account', label: 'Account', icon: 'fas fa-user-circle', countId: 'count-acc' },
  { key: 'reports', label: 'Reports', icon: 'fas fa-file-invoice', countId: 'count-rp' },
  { key: 'contact-faq', label: 'Contact & Escalation', icon: 'fas fa-headset', countId: 'count-cf' },
  { key: 'mtf', label: 'MTF', icon: 'fas fa-layer-group', countId: 'count-mtf' },
  { key: 'tender-offers', label: 'Tender Offers', icon: 'fas fa-hand-holding-dollar', countId: 'count-tender' },
  { key: 'kyc', label: 'KYC Process', icon: 'fas fa-fingerprint', countId: 'count-kyc' },
  { key: 'charges', label: 'Charges & Brokerage', icon: 'fas fa-tags', countId: 'count-ch' },
  { key: 'compliance', label: 'Compliance & Safety', icon: 'fas fa-shield-halved', countId: 'count-comp' },
  { key: 'mutual-funds', label: 'Mutual Funds', icon: 'fas fa-seedling', countId: 'count-mf' },
  { key: 'nri', label: 'NRI / HUF Accounts', icon: 'fas fa-globe', countId: 'count-nri' },
];

function FAQContent() {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat') || 'all';

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCat, setSelectedCat] = useState(catParam);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCat(catParam);
  }, [catParam]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      setArticles(items.filter((a) => !a.status || a.status === 'published' || a.status === 'active'));
    } catch {
      setError('Unable to load articles. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const filtered = articles.filter((a) => {
    const matchesCat = selectedCat === 'all' || a.category?.toLowerCase() === selectedCat;
    const matchesSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.content?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const grouped = filtered.reduce<Record<string, Article[]>>((acc, a) => {
    const cat = a.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const getCount = (key: string) => {
    if (key === 'all') return articles.length;
    return articles.filter(a => a.category?.toLowerCase() === key).length;
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
          {CATEGORIES.slice(0, 15).map((cat) => (
            <button
              key={cat.key}
              className={`kb-nav-link${selectedCat === cat.key ? ' active' : ''}`}
              onClick={() => setSelectedCat(cat.key)}
            >
              <i className={cat.icon} style={{ width: '14px' }}></i>
              {cat.label} <span className="nav-count">{getCount(cat.key) || ''}</span>
            </button>
          ))}

          <p className="kb-sidebar-title" style={{ marginTop: '0.75rem' }}>New Topics</p>
          {CATEGORIES.slice(15).map((cat) => (
            <button
              key={cat.key}
              className={`kb-nav-link${selectedCat === cat.key ? ' active' : ''}`}
              onClick={() => setSelectedCat(cat.key)}
            >
              <i className={cat.icon} style={{ width: '14px' }}></i>
              {cat.label} <span className="nav-count">{getCount(cat.key) || ''}</span>
            </button>
          ))}
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
              rel="noopener"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-mid)', padding: '0.3rem 0', textDecoration: 'none' }}
            >
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.6rem' }}></i> {link.label}
            </a>
          ))}
        </div>
      </aside>

      {/* MAIN ARTICLES */}
      <main className="kb-main">
        <div className="notice-banner">
          <i className="fas fa-shield-halved"></i>
          <span><strong>Verified content:</strong> All articles are cross-referenced with official Indiabulls Securities policies.</span>
        </div>

        <div className="kb-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 id="kbHeading">{heading}</h1>
              <p id="kbSubheading">Browse all support articles or filter by topic from the sidebar.</p>
            </div>
            <div className="search-wrapper" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
              <i className="fas fa-search search-icon"></i>
              <input
                id="faqSearch"
                type="text"
                className="search-input"
                placeholder="Search Knowledge Base..."
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div id="articleContainer">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <p style={{ color: 'var(--red)', marginBottom: '1rem' }}>{error}</p>
              <button onClick={fetchArticles} className="btn-primary">Try Again</button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-search" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}></i>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No articles found for &quot;{search || heading}&quot;</p>
              <Link href="/contact" className="btn-primary">Contact Support</Link>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="article-group" data-cat={cat.toLowerCase()}>
                <p className="article-group-title">{cat}</p>
                {items.map((article) => (
                  <div key={article.id} className="article-card" id={article.id}>
                    <button
                      className={`article-trigger${openId === article.id ? ' open' : ''}`}
                      onClick={() => setOpenId(openId === article.id ? null : article.id)}
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
                          <button className="feedback-btn" data-type="yes">
                            <i className="far fa-thumbs-up"></i> Yes
                          </button>
                          <button className="feedback-btn" data-type="no">
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
      </div>
    }>
      <FAQContent />
    </Suspense>
  );
}
