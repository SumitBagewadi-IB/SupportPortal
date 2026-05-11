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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allArticlesRef = useRef<Article[]>([]);

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

        {/* CATEGORIES */}
        <div className="section">
          <p className="section-title">Browse by topic</p>
          <div className="category-grid">
            <Link href="/faq?cat=getting-started" className="cat-card" id="cat-getting-started">
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00AB4E' }}><i className="fas fa-rocket"></i></div>
              <div><h3>Getting Started</h3><p>Account, KYC, first trade</p></div>
            </Link>
            <Link href="/faq?cat=account-opening" className="cat-card" id="cat-account-opening">
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00AB4E' }}><i className="fas fa-id-card"></i></div>
              <div><h3>Account Opening</h3><p>KYC, documents, activation</p></div>
            </Link>
            <Link href="/faq?cat=trading" className="cat-card" id="cat-trading">
              <div className="cat-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}><i className="fas fa-chart-line"></i></div>
              <div><h3>Trading</h3><p>Orders, GTT, Basket, AMO</p></div>
            </Link>
            <Link href="/faq?cat=portfolio" className="cat-card" id="cat-portfolio">
              <div className="cat-icon" style={{ background: '#FFF7ED', color: '#F97316' }}><i className="fas fa-briefcase"></i></div>
              <div><h3>Portfolio &amp; Margin</h3><p>P&amp;L, Holdings, Pledge, MTF</p></div>
            </Link>
            <Link href="/faq?cat=funds" className="cat-card" id="cat-funds">
              <div className="cat-icon" style={{ background: '#FAF5FF', color: '#A855F7' }}><i className="fas fa-wallet"></i></div>
              <div><h3>Funds</h3><p>Add, withdraw, ledger</p></div>
            </Link>
            <Link href="/faq?cat=charges" className="cat-card" id="cat-charges">
              <div className="cat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}><i className="fas fa-tags"></i></div>
              <div><h3>Charges &amp; Brokerage</h3><p>STT, GST, DP, brokerage plans</p></div>
            </Link>
            <Link href="/faq?cat=compliance" className="cat-card" id="cat-compliance">
              <div className="cat-icon" style={{ background: '#FFF1F2', color: '#F43F5E' }}><i className="fas fa-shield-halved"></i></div>
              <div><h3>Compliance &amp; Safety</h3><p>TPIN, eDIS, ASM/GSM, 2FA</p></div>
            </Link>
            <Link href="/faq?cat=mutual-funds" className="cat-card" id="cat-mf">
              <div className="cat-icon" style={{ background: '#ECFDF5', color: '#10B981' }}><i className="fas fa-seedling"></i></div>
              <div><h3>Mutual Funds</h3><p>SIP, lump sum, ELSS, redemption</p></div>
            </Link>
            <Link href="/faq?cat=ipo" className="cat-card" id="cat-ipo">
              <div className="cat-icon" style={{ background: '#FFF1F2', color: '#F43F5E' }}><i className="fas fa-rocket"></i></div>
              <div><h3>IPO</h3><p>Apply for IPOs, allotment status, listing</p></div>
            </Link>
            <Link href="/faq?cat=fo" className="cat-card" id="cat-fo">
              <div className="cat-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}><i className="fas fa-bolt"></i></div>
              <div><h3>F&amp;O</h3><p>Futures, options, margins, expiry</p></div>
            </Link>
            <Link href="/faq?cat=pledging" className="cat-card" id="cat-pledge">
              <div className="cat-icon" style={{ background: '#F1F5F9', color: '#0F172A' }}><i className="fas fa-link"></i></div>
              <div><h3>Pledging</h3><p>Collateral margin, shares pledge, haircut</p></div>
            </Link>
            <Link href="/faq?cat=mtf" className="cat-card" id="cat-mtf">
              <div className="cat-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}><i className="fas fa-layer-group"></i></div>
              <div><h3>MTF</h3><p>Margin Trading Facility, leverage funding</p></div>
            </Link>
            <Link href="/faq?cat=tender-offers" className="cat-card" id="cat-tender">
              <div className="cat-icon" style={{ background: '#F0F9FF', color: '#0284C7' }}><i className="fas fa-hand-holding-dollar"></i></div>
              <div><h3>Tender Offers</h3><p>Buybacks, OFS, delisting participation</p></div>
            </Link>
            <Link href="/faq?cat=contact-faq" className="cat-card" id="cat-contact-faq">
              <div className="cat-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}><i className="fas fa-headset"></i></div>
              <div><h3>Contact &amp; Help</h3><p>Support desk, office address, escalation</p></div>
            </Link>
            <Link href="/faq?cat=advanced" className="cat-card" id="cat-advanced">
              <div className="cat-icon" style={{ background: '#F0F9FF', color: '#0284C7' }}><i className="fas fa-robot"></i></div>
              <div><h3>Advanced</h3><p>Algo, MTF, Smallcase, Webhooks</p></div>
            </Link>
            <Link href="/faq?cat=account" className="cat-card" id="cat-account">
              <div className="cat-icon" style={{ background: '#F0FDF4', color: '#22C55E' }}><i className="fas fa-user-circle"></i></div>
              <div><h3>Account</h3><p>Profile, security, segments</p></div>
            </Link>
            <Link href="/faq?cat=reports" className="cat-card" id="cat-reports">
              <div className="cat-icon" style={{ background: '#F8FAFC', color: '#64748B' }}><i className="fas fa-file-invoice"></i></div>
              <div><h3>Reports</h3><p>Tax P&amp;L, contract notes, ledger</p></div>
            </Link>
            <Link href="/faq?cat=nri" className="cat-card" id="cat-nri">
              <div className="cat-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}><i className="fas fa-globe"></i></div>
              <div><h3>NRI / HUF Accounts</h3><p>NRE/NRO, PIS, repatriation</p></div>
            </Link>
            <Link href="/contact" className="cat-card" id="cat-contact-us">
              <div className="cat-icon" style={{ background: '#FFF9C4', color: '#CA8A04' }}><i className="fas fa-headset"></i></div>
              <div><h3>Contact Us</h3><p>Chat, call, raise ticket</p></div>
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
