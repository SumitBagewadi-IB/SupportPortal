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
      setArticles(items.filter((a) => !a.status || a.status === 'published' || a.status === 'active' || a.status === 'approved'));
    } catch {
      setArticles([
        { id: 'acc-open', title: 'How to Open Demat account in Indiabulls Securities?', category: 'Account Opening', status: 'published', content: `To open a Demat account with Indiabulls Securities:\n\n1. Visit the Indiabulls Securities website and click "Open Account".\n2. Enter your mobile number and verify via OTP.\n3. Fill in your personal details — name, PAN, date of birth, and address.\n4. Complete e-KYC by uploading your Aadhaar, PAN card, and a selfie.\n5. Sign the application digitally using Aadhaar OTP-based e-Sign.\n6. Your account will be activated within 1–2 business days.\n\nRequirements:\n- PAN Card (mandatory)\n- Aadhaar Card (for e-KYC)\n- Bank account details\n- Mobile linked to Aadhaar\n\nFor NRI accounts, additional documents like PIO/OCI card and NRE/NRO bank account details are required.` },
        { id: 'gtt', title: 'How to place a GTT (Good Till Trigger) order?', category: 'Trading', status: 'published', content: `GTT (Good Till Trigger) orders let you set buy/sell triggers that execute automatically when the market price hits your target.\n\nSteps to place a GTT order:\n1. Log in to the Indiabulls Securities app or web platform.\n2. Search for a stock and open its detail page.\n3. Click "GTT" or "Set Trigger" option.\n4. Choose the trigger type: Single trigger (one-sided) or OCO (One Cancels Other).\n5. Enter the trigger price and the limit price for the order.\n6. Set the quantity and confirm.\n\nKey points:\n- GTT orders are valid for 1 year from the date of creation.\n- The order is placed only when the trigger price is hit.\n- GTT is available for equity delivery orders only (not intraday).\n- You can view and cancel active GTT orders from the Order Book.` },
        { id: 'add-funds', title: 'How to add funds to my trading account?', category: 'Funds', status: 'published', content: `You can add funds to your Indiabulls Securities trading account instantly using the following methods:\n\n1. UPI (Instant): Open the app → Funds → Add Funds → Enter amount → Select UPI → Authenticate on your UPI app.\n2. Net Banking (Instant): Select your bank from the list, log in, and authorize the transfer.\n3. NEFT/RTGS: Use your unique client code-based account number provided in the app. Funds reflect within 30 minutes during banking hours.\n\nLimits:\n- UPI: Up to ₹1 lakh per transaction (₹2 lakh for UPI 2.0-enabled banks).\n- Net Banking: No upper limit (subject to bank limits).\n\nAdded funds are available for trading immediately after confirmation.` },
        { id: 'tpin', title: 'How to generate and use CDSL TPIN for selling shares?', category: 'Compliance & Safety', status: 'published', content: `CDSL TPIN (Transaction PIN) is required to authorize the sale of shares from your Demat account as per SEBI mandate.\n\nGenerating your TPIN:\n1. Go to cdsl.com or use the CDSL Easiest portal.\n2. Register with your BO ID (Demat account number) and PAN.\n3. Set a 6-digit TPIN via OTP verification.\n\nUsing TPIN while selling:\n1. Place a sell order in your trading platform.\n2. You will receive an OTP on your registered mobile/email.\n3. Enter the TPIN + OTP to authorize the debit of shares.\n\nNote: TPIN/eDIS is mandatory for all sell transactions. Failure to authorize will result in a short delivery penalty.` },
        { id: 'brokerage', title: 'What are Indiabulls Securities brokerage charges and pricing plans?', category: 'Charges & Brokerage', status: 'published', content: `Indiabulls Securities offers the following brokerage plans:\n\nFlat Fee Plan:\n- Equity Delivery: ₹0 (free)\n- Equity Intraday: ₹20 per executed order or 0.05%, whichever is lower\n- F&O (Futures): ₹20 per executed order\n- F&O (Options): ₹20 per executed order\n- Currency: ₹20 per executed order\n\nOther applicable charges (regulatory):\n- STT: 0.1% on delivery; 0.025% on intraday sell side\n- Exchange Transaction Charges: 0.00335% (NSE equity)\n- GST: 18% on brokerage + transaction charges\n- SEBI Turnover Fee: ₹10 per crore\n- DP Charges: ₹13.5 + GST per scrip per day on delivery sell\n\nUse the brokerage calculator in the app to estimate charges before trading.` },
        { id: 'ipo-apply', title: 'How to apply for an IPO via UPI mandate?', category: 'IPO', status: 'published', content: `Applying for an IPO through Indiabulls Securities using UPI:\n\n1. Go to IPO section in the app or web platform.\n2. Select the open IPO you want to apply for.\n3. Enter the number of lots and bid price (use the cut-off price for retail investors).\n4. Enter your UPI ID (e.g., yourname@okaxis).\n5. Submit the application — you'll receive a mandate request on your UPI app.\n6. Open your UPI app (BHIM, GPay, PhonePe, etc.) and approve the mandate.\n\nImportant:\n- Funds are blocked (not debited) until allotment.\n- If not allotted, funds are released within T+6 days.\n- Category: Retail (up to ₹2 lakh), HNI (above ₹2 lakh).` },
        { id: 'fo-ban', title: 'What is the F&O Ban Period and why does it happen?', category: 'F&O', status: 'published', content: `The F&O Ban Period is imposed on a stock when the total open interest (OI) exceeds 95% of the Market-Wide Position Limit (MWPL).\n\nDuring the ban period:\n- No new F&O positions can be opened in that stock.\n- You can only square off (close) existing positions.\n- Violation attracts a penalty of ₹1 lakh or 1% of the open position value.\n\nThe ban is lifted when OI drops below 80% of MWPL.\n\nHow to check ban list:\n- NSE publishes the F&O ban list daily on its website.\n- Your trading platform will also show a warning when you try to trade a banned stock.` },
        { id: 'basket', title: 'How to execute a Basket Order?', category: 'Trading', status: 'published', content: `Basket Orders allow you to place multiple buy/sell orders simultaneously with a single click.\n\nSteps:\n1. Go to the Basket Order section in the trading platform.\n2. Click "Create Basket" and give it a name.\n3. Add stocks/F&O contracts to the basket by searching and selecting instruments.\n4. Set the quantity, order type (market/limit), and buy/sell direction for each.\n5. Review the basket and click "Execute All".\n\nNote: Each order in the basket is placed independently — partial fills are possible.` },
        { id: 'tax-pl', title: 'How to download my Tax P&L statement for ITR filing?', category: 'Reports', status: 'published', content: `Your Tax P&L (Profit & Loss) report is essential for filing your Income Tax Return (ITR).\n\nSteps to download:\n1. Log in to the Indiabulls Securities web platform.\n2. Go to Reports → Tax P&L or Tax Statement.\n3. Select the financial year (e.g., April 2024 – March 2025).\n4. Click Download — the report is available in PDF or Excel format.\n\nThe report includes:\n- Short-term capital gains (STCG)\n- Long-term capital gains (LTCG)\n- Speculative income (intraday equity)\n- F&O business income (non-speculative)` },
        { id: 'algo', title: 'What is Indiabulls Securities Algo and how to use it?', category: 'Advanced', status: 'published', content: `Indiabulls Securities offers API-based algorithmic trading for advanced traders and developers.\n\nKey features:\n- REST API access for order placement, modification, and cancellation.\n- WebSocket streaming for real-time market data (tick-by-tick).\n- Support for equity, F&O, and currency segments.\n\nGetting started:\n1. Apply for API access from your account settings or contact your relationship manager.\n2. Generate your API key and secret from the developer portal.\n3. Use the provided SDK (Python/Java/Node.js) or integrate directly with REST APIs.\n4. Authenticate using OAuth2 and begin placing orders programmatically.` },
        { id: 'sip', title: 'How to set up a SIP in Mutual Funds?', category: 'Mutual Funds', status: 'published', content: `Setting up a Systematic Investment Plan (SIP) through Indiabulls Securities:\n\n1. Go to Mutual Funds section in the app.\n2. Search for the fund you want to invest in.\n3. Click "Invest" → Select "SIP".\n4. Enter the monthly SIP amount (minimum ₹500 for most funds).\n5. Choose the SIP date and payment method (UPI / Net Banking).\n6. Confirm and activate the SIP.\n\nKey points:\n- SIPs are auto-debited on the chosen date every month.\n- You can pause or cancel a SIP anytime from the Mutual Funds dashboard.\n- ELSS SIPs qualify for tax deduction under Section 80C (up to ₹1.5 lakh/year).` },
        { id: 'withdraw', title: 'How long does fund withdrawal take?', category: 'Funds', status: 'published', content: `Fund withdrawal timelines from Indiabulls Securities:\n\n- Instant Withdrawal: Available 24×7. Funds credited to your bank within minutes.\n- Normal Withdrawal: Processed within the same day if requested before 3:30 PM. Credited by next business day (T+1).\n- Weekend/Holiday requests: Processed on the next working day.\n\nSteps to withdraw:\n1. Go to Funds → Withdraw.\n2. Enter the amount (must not exceed your withdrawable balance).\n3. Confirm your bank account and submit.\n\nNote: Equity delivery sale proceeds are available after T+1 settlement.` },
        { id: 'ipo2', title: 'How to apply for an IPO through Indiabulls Securities?', category: 'IPO', status: 'published', content: `You can apply for IPOs through Indiabulls Securities using ASBA (Application Supported by Blocked Amount):\n\nMethod 1 — via App/Web:\n1. Open the IPO section and select the live IPO.\n2. Enter bid details (lots, price, UPI ID).\n3. Approve the UPI mandate — funds are blocked until allotment.\n\nMethod 2 — via Net Banking ASBA:\n1. Log in to your bank's net banking portal.\n2. Go to the IPO/ASBA section.\n3. Enter your DP ID, client ID, and bid details.\n\nAfter allotment:\n- If allotted: Shares are credited to your Demat account on listing day.\n- If not allotted: Blocked funds are released within 6 working days.` },
      ]);
      setError('');
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
