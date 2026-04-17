'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ title: string; category: string; id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/faq`);
      if (res.ok) {
        const data = await res.json();
        const articles = Array.isArray(data) ? data : (data.items || data.articles || []);
        const filtered = articles.filter((a: { title?: string; category?: string }) =>
          a.title?.toLowerCase().includes(q.toLowerCase()) ||
          a.category?.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 6);
        setResults(filtered);
        setShowDropdown(filtered.length > 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(val);
    }, 300);
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

          />
          {showDropdown && results.length > 0 && (
            <div id="searchResults" className="search-results-dropdown active">
              {results.map((article, i) => (
                <Link
                  key={i}
                  href={`/faq?cat=${encodeURIComponent(article.category)}`}
                  className="search-result-item"
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
            </div>
          )}
          {!showDropdown && <div id="searchResults" className="search-results-dropdown"></div>}
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
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00C805' }}><i className="fas fa-rocket"></i></div>
              <div>
                <h3>Getting Started</h3>
                <p>Account, KYC, first trade</p>
              </div>
            </Link>
            <Link href="/faq?cat=account-opening" className="cat-card" id="cat-account-opening">
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00C805' }}><i className="fas fa-id-card"></i></div>
              <div>
                <h3>Account Opening</h3>
                <p>KYC, documents, activation</p>
              </div>
            </Link>
            <Link href="/faq?cat=trading" className="cat-card" id="cat-trading">
              <div className="cat-icon" style={{ background: '#EFF6FF', color: '#3B82F6' }}><i className="fas fa-chart-line"></i></div>
              <div>
                <h3>Trading</h3>
                <p>Orders, GTT, Basket, AMO</p>
              </div>
            </Link>
            <Link href="/faq?cat=portfolio" className="cat-card" id="cat-portfolio">
              <div className="cat-icon" style={{ background: '#FFF7ED', color: '#F97316' }}><i className="fas fa-briefcase"></i></div>
              <div>
                <h3>Portfolio &amp; Margin</h3>
                <p>P&amp;L, Holdings, Pledge, MTF</p>
              </div>
            </Link>
            <Link href="/faq?cat=funds" className="cat-card" id="cat-funds">
              <div className="cat-icon" style={{ background: '#FAF5FF', color: '#A855F7' }}><i className="fas fa-wallet"></i></div>
              <div>
                <h3>Funds</h3>
                <p>Add, withdraw, ledger</p>
              </div>
            </Link>
            <Link href="/faq?cat=charges" className="cat-card" id="cat-charges">
              <div className="cat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}><i className="fas fa-tags"></i></div>
              <div>
                <h3>Charges &amp; Brokerage</h3>
                <p>STT, GST, DP, brokerage plans</p>
              </div>
            </Link>
            <Link href="/faq?cat=compliance" className="cat-card" id="cat-compliance">
              <div className="cat-icon" style={{ background: '#FFF1F2', color: '#F43F5E' }}><i className="fas fa-shield-halved"></i></div>
              <div>
                <h3>Compliance &amp; Safety</h3>
                <p>TPIN, eDIS, ASM/GSM, 2FA</p>
              </div>
            </Link>
            <Link href="/faq?cat=mutual-funds" className="cat-card" id="cat-mf">
              <div className="cat-icon" style={{ background: '#ECFDF5', color: '#10B981' }}><i className="fas fa-seedling"></i></div>
              <div>
                <h3>Mutual Funds</h3>
                <p>SIP, lump sum, ELSS, redemption</p>
              </div>
            </Link>
            <Link href="/faq?cat=ipo" className="cat-card" id="cat-ipo">
              <div className="cat-icon" style={{ background: '#FFF1F2', color: '#F43F5E' }}><i className="fas fa-rocket"></i></div>
              <div>
                <h3>IPO</h3>
                <p>Apply for IPOs, allotment status, listing</p>
              </div>
            </Link>
            <Link href="/faq?cat=fo" className="cat-card" id="cat-fo">
              <div className="cat-icon" style={{ background: '#FFFBEB', color: '#F59E0B' }}><i className="fas fa-bolt"></i></div>
              <div>
                <h3>F&amp;O</h3>
                <p>Futures, options, margins, expiry</p>
              </div>
            </Link>
            <Link href="/faq?cat=pledging" className="cat-card" id="cat-pledge">
              <div className="cat-icon" style={{ background: '#F1F5F9', color: '#0F172A' }}><i className="fas fa-link"></i></div>
              <div>
                <h3>Pledging</h3>
                <p>Collateral margin, shares pledge, haircut</p>
              </div>
            </Link>
            <Link href="/faq?cat=mtf" className="cat-card" id="cat-mtf">
              <div className="cat-icon" style={{ background: '#F5F3FF', color: '#8B5CF6' }}><i className="fas fa-layer-group"></i></div>
              <div>
                <h3>MTF</h3>
                <p>Margin Trading Facility, leverage funding</p>
              </div>
            </Link>
            <Link href="/faq?cat=tender-offers" className="cat-card" id="cat-tender">
              <div className="cat-icon" style={{ background: '#F0F9FF', color: '#0284C7' }}><i className="fas fa-hand-holding-dollar"></i></div>
              <div>
                <h3>Tender Offers</h3>
                <p>Buybacks, OFS, delisting participation</p>
              </div>
            </Link>
            <Link href="/faq?cat=contact-faq" className="cat-card" id="cat-contact-faq">
              <div className="cat-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}><i className="fas fa-headset"></i></div>
              <div>
                <h3>Contact &amp; Help</h3>
                <p>Support desk, office address, escalation</p>
              </div>
            </Link>
            <Link href="/faq?cat=advanced" className="cat-card" id="cat-advanced">
              <div className="cat-icon" style={{ background: '#F0F9FF', color: '#0284C7' }}><i className="fas fa-robot"></i></div>
              <div>
                <h3>Advanced</h3>
                <p>Algo, MTF, Smallcase, Webhooks</p>
              </div>
            </Link>
            <Link href="/faq?cat=account" className="cat-card" id="cat-account">
              <div className="cat-icon" style={{ background: '#F0FDF4', color: '#22C55E' }}><i className="fas fa-user-circle"></i></div>
              <div>
                <h3>Account</h3>
                <p>Profile, security, segments</p>
              </div>
            </Link>
            <Link href="/faq?cat=reports" className="cat-card" id="cat-reports">
              <div className="cat-icon" style={{ background: '#F8FAFC', color: '#64748B' }}><i className="fas fa-file-invoice"></i></div>
              <div>
                <h3>Reports</h3>
                <p>Tax P&amp;L, contract notes, ledger</p>
              </div>
            </Link>
            <Link href="/faq?cat=nri" className="cat-card" id="cat-nri">
              <div className="cat-icon" style={{ background: '#F5F3FF', color: '#7C3AED' }}><i className="fas fa-globe"></i></div>
              <div>
                <h3>NRI / HUF Accounts</h3>
                <p>NRE/NRO, PIS, repatriation</p>
              </div>
            </Link>
            <Link href="/contact" className="cat-card" id="cat-contact-us">
              <div className="cat-icon" style={{ background: '#FFF9C4', color: '#CA8A04' }}><i className="fas fa-headset"></i></div>
              <div>
                <h3>Contact Us</h3>
                <p>Chat, call, raise ticket</p>
              </div>
            </Link>
          </div>
        </div>

        {/* POPULAR ARTICLES */}
        <div className="section">
          <p className="section-title">Popular articles</p>
          <div className="article-list">
            <Link href="/faq?cat=account-opening#acc-how-to-open" className="article-row" id="pop-acc-open">
              <div className="article-row-text">
                <h4>How to Open Demat account in Indiabulls Securities?</h4>
                <span>Account Opening · 5 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 15.2k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=trading#gtt" className="article-row" id="pop-gtt">
              <div className="article-row-text">
                <h4>How to place a GTT (Good Till Trigger) order?</h4>
                <span>Trading · 3 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 12.4k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=funds#add-funds" className="article-row" id="pop-add-funds">
              <div className="article-row-text">
                <h4>How to add funds to my trading account?</h4>
                <span>Funds · 2 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 9.7k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=compliance#tpin" className="article-row" id="pop-tpin">
              <div className="article-row-text">
                <h4>How to generate and use CDSL TPIN for selling shares?</h4>
                <span>Compliance · 3 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 8.1k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=charges#brokerage" className="article-row" id="pop-brokerage">
              <div className="article-row-text">
                <h4>What are Indiabulls Securities brokerage charges and pricing plans?</h4>
                <span>Charges · 4 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 7.9k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=ipo#ipo-apply" className="article-row" id="pop-ipo">
              <div className="article-row-text">
                <h4>How to apply for an IPO via UPI mandate?</h4>
                <span>IPO · 3 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 6.8k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=fo#fo-ban-period" className="article-row" id="pop-fo-ban">
              <div className="article-row-text">
                <h4>What is the F&amp;O Ban Period and why does it happen?</h4>
                <span>F&amp;O · 4 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 4.5k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=trading#basket" className="article-row" id="pop-basket">
              <div className="article-row-text">
                <h4>How to execute a Basket Order?</h4>
                <span>Trading · 2 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 5.2k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=reports#tax-pl" className="article-row" id="pop-tax">
              <div className="article-row-text">
                <h4>How to download my Tax P&amp;L statement for ITR filing?</h4>
                <span>Reports · 3 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 4.8k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=advanced#algo" className="article-row" id="pop-algo">
              <div className="article-row-text">
                <h4>What is Indiabulls Securities Algo and how to use it?</h4>
                <span>Advanced · 4 min read</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=mutual-funds#sip" className="article-row" id="pop-sip">
              <div className="article-row-text">
                <h4>How to set up a SIP in Mutual Funds?</h4>
                <span>Mutual Funds · 2 min read <span className="badge-new-inline">New</span></span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=funds#withdraw" className="article-row" id="pop-withdraw">
              <div className="article-row-text">
                <h4>How long does fund withdrawal take?</h4>
                <span>Funds · 1 min read · <i className="fas fa-eye" style={{ fontSize: '0.7rem' }}></i> 3.4k views</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
            <Link href="/faq?cat=advanced#ipo" className="article-row" id="pop-ipo2">
              <div className="article-row-text">
                <h4>How to apply for an IPO through Indiabulls Securities?</h4>
                <span>Advanced · 3 min read</span>
              </div>
              <i className="fas fa-chevron-right"></i>
            </Link>
          </div>
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

        {/* TRUST & SECURITY */}
        <div className="section" style={{ borderTop: '1px solid var(--border)', marginTop: '3rem', padding: '4rem 0' }}>
          <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 3rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
              Trusted by 5 Million+ Traders
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Experience institutional-grade security and transparency across every trade you execute on Indiabulls Securities.
            </p>
          </div>
          <div className="trust-grid">
            <div className="trust-item">
              <i className="fas fa-shield-check" style={{ color: '#10B981' }}></i>
              <div className="trust-item-content">
                <h4>SEBI Registered</h4>
                <p>Compliant with all regulatory frameworks for safe investing.</p>
              </div>
            </div>
            <div className="trust-item">
              <i className="fas fa-lock-keyhole" style={{ color: '#3B82F6' }}></i>
              <div className="trust-item-content">
                <h4>Bank-grade Security</h4>
                <p>Enforced with 256-bit encryption and two-factor authentication.</p>
              </div>
            </div>
            <div className="trust-item">
              <i className="fas fa-building-columns" style={{ color: '#F59E0B' }}></i>
              <div className="trust-item-content">
                <h4>CDSL/NSE/BSE Member</h4>
                <p>Direct connectivity to India&apos;s major financial exchanges.</p>
              </div>
            </div>
          </div>
        </div>

      </main>
    </>
  );
}
