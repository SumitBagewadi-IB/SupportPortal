'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

const POPULAR_ARTICLES = [
  {
    id: 'acc-open',
    title: 'How to Open Demat account in Indiabulls Securities?',
    meta: 'Account Opening · 5 min read · 15.2k views',
    content: `To open a Demat account with Indiabulls Securities:

1. Visit the Indiabulls Securities website and click "Open Account".
2. Enter your mobile number and verify via OTP.
3. Fill in your personal details — name, PAN, date of birth, and address.
4. Complete e-KYC by uploading your Aadhaar, PAN card, and a selfie.
5. Sign the application digitally using Aadhaar OTP-based e-Sign.
6. Your account will be activated within 1–2 business days.

Requirements:
- PAN Card (mandatory)
- Aadhaar Card (for e-KYC)
- Bank account details
- Mobile linked to Aadhaar

For NRI accounts, additional documents like PIO/OCI card and NRE/NRO bank account details are required.`,
  },
  {
    id: 'gtt',
    title: 'How to place a GTT (Good Till Trigger) order?',
    meta: 'Trading · 3 min read · 12.4k views',
    content: `GTT (Good Till Trigger) orders let you set buy/sell triggers that execute automatically when the market price hits your target.

Steps to place a GTT order:
1. Log in to the Indiabulls Securities app or web platform.
2. Search for a stock and open its detail page.
3. Click "GTT" or "Set Trigger" option.
4. Choose the trigger type: Single trigger (one-sided) or OCO (One Cancels Other — for both buy and stop-loss).
5. Enter the trigger price and the limit price for the order.
6. Set the quantity and confirm.

Key points:
- GTT orders are valid for 1 year from the date of creation.
- The order is placed only when the trigger price is hit.
- GTT is available for equity delivery orders only (not intraday).
- You can view and cancel active GTT orders from the Order Book.`,
  },
  {
    id: 'add-funds',
    title: 'How to add funds to my trading account?',
    meta: 'Funds · 2 min read · 9.7k views',
    content: `You can add funds to your Indiabulls Securities trading account instantly using the following methods:

1. UPI (Instant): Open the app → Funds → Add Funds → Enter amount → Select UPI → Authenticate on your UPI app.
2. Net Banking (Instant): Select your bank from the list, log in, and authorize the transfer.
3. NEFT/RTGS: Use your unique client code-based account number provided in the app. Funds reflect within 30 minutes during banking hours.

Limits:
- UPI: Up to ₹1 lakh per transaction (₹2 lakh for UPI 2.0-enabled banks).
- Net Banking: No upper limit (subject to bank limits).

Added funds are available for trading immediately after confirmation.`,
  },
  {
    id: 'tpin',
    title: 'How to generate and use CDSL TPIN for selling shares?',
    meta: 'Compliance · 3 min read · 8.1k views',
    content: `CDSL TPIN (Transaction PIN) is required to authorize the sale of shares from your Demat account as per SEBI mandate.

Generating your TPIN:
1. Go to cdsl.com or use the CDSL Easiest portal.
2. Register with your BO ID (Demat account number) and PAN.
3. Set a 6-digit TPIN via OTP verification.

Using TPIN while selling:
1. Place a sell order in your trading platform.
2. You will receive an OTP on your registered mobile/email.
3. Enter the TPIN + OTP to authorize the debit of shares.

Alternatively, use the eDIS (electronic Delivery Instruction Slip) method:
- Pre-authorize shares for sale using Aadhaar OTP via CDSL.
- Valid for the current trading day only.

Note: TPIN/eDIS is mandatory for all sell transactions. Failure to authorize will result in a short delivery penalty.`,
  },
  {
    id: 'brokerage',
    title: 'What are Indiabulls Securities brokerage charges and pricing plans?',
    meta: 'Charges · 4 min read · 7.9k views',
    content: `Indiabulls Securities offers the following brokerage plans:

Flat Fee Plan:
- Equity Delivery: ₹0 (free)
- Equity Intraday: ₹20 per executed order or 0.05%, whichever is lower
- F&O (Futures): ₹20 per executed order
- F&O (Options): ₹20 per executed order
- Currency: ₹20 per executed order

Other applicable charges (regulatory):
- STT: 0.1% on delivery; 0.025% on intraday sell side
- Exchange Transaction Charges: 0.00335% (NSE equity)
- GST: 18% on brokerage + transaction charges
- SEBI Turnover Fee: ₹10 per crore
- Stamp Duty: As per state (0.015% on delivery buy, 0.003% on intraday/F&O)
- DP Charges: ₹13.5 + GST per scrip per day on delivery sell

Use the brokerage calculator in the app to estimate charges before trading.`,
  },
  {
    id: 'ipo-apply',
    title: 'How to apply for an IPO via UPI mandate?',
    meta: 'IPO · 3 min read · 6.8k views',
    content: `Applying for an IPO through Indiabulls Securities using UPI:

1. Go to IPO section in the app or web platform.
2. Select the open IPO you want to apply for.
3. Enter the number of lots and bid price (use the cut-off price for retail investors).
4. Enter your UPI ID (e.g., yourname@okaxis).
5. Submit the application — you'll receive a mandate request on your UPI app.
6. Open your UPI app (BHIM, GPay, PhonePe, etc.) and approve the mandate.

Important:
- Funds are blocked (not debited) until allotment.
- If not allotted, funds are released within T+6 days.
- Apply before the IPO close date; last-day server load may cause delays.
- Category: Retail (up to ₹2 lakh), HNI (above ₹2 lakh).`,
  },
  {
    id: 'fo-ban',
    title: 'What is the F&O Ban Period and why does it happen?',
    meta: 'F&O · 4 min read · 4.5k views',
    content: `The F&O Ban Period (also called the trading ban or MWPL ban) is imposed on a stock when the total open interest (OI) in its futures and options contracts exceeds 95% of the Market-Wide Position Limit (MWPL).

During the ban period:
- No new F&O positions can be opened in that stock.
- You can only square off (close) existing positions.
- Violation attracts a penalty of ₹1 lakh or 1% of the value of the open position, whichever is higher.

The ban is lifted when OI drops below 80% of MWPL.

How to check ban list:
- NSE publishes the F&O ban list daily on its website.
- Your trading platform will also show a warning when you try to trade a banned stock.

Stocks frequently in the ban list include high-OI mid-cap names. Monitor NSE's daily circular before placing F&O orders.`,
  },
  {
    id: 'basket',
    title: 'How to execute a Basket Order?',
    meta: 'Trading · 2 min read · 5.2k views',
    content: `Basket Orders allow you to place multiple buy/sell orders simultaneously with a single click.

Steps:
1. Go to the Basket Order section in the trading platform.
2. Click "Create Basket" and give it a name.
3. Add stocks/F&O contracts to the basket by searching and selecting instruments.
4. Set the quantity, order type (market/limit), and buy/sell direction for each.
5. Review the basket and click "Execute All".

Use cases:
- Rebalancing your portfolio in one go.
- Executing a multi-leg options strategy simultaneously.
- Deploying a predefined watchlist of stocks.

Note: Each order in the basket is placed independently — partial fills are possible if one leg hits a circuit limit or liquidity issue.`,
  },
  {
    id: 'tax-pl',
    title: 'How to download my Tax P&L statement for ITR filing?',
    meta: 'Reports · 3 min read · 4.8k views',
    content: `Your Tax P&L (Profit & Loss) report is essential for filing your Income Tax Return (ITR) as it details realized gains/losses from trading.

Steps to download:
1. Log in to the Indiabulls Securities web platform.
2. Go to Reports → Tax P&L or Tax Statement.
3. Select the financial year (e.g., April 2024 – March 2025).
4. Click Download — the report is available in PDF or Excel format.

The report includes:
- Short-term capital gains (STCG) — held less than 1 year for equity.
- Long-term capital gains (LTCG) — held more than 1 year.
- Speculative income (intraday equity).
- F&O business income (treated as non-speculative business income).

Share the report with your CA or use it directly in ITR-2/ITR-3 as applicable.`,
  },
  {
    id: 'algo',
    title: 'What is Indiabulls Securities Algo and how to use it?',
    meta: 'Advanced · 4 min read',
    content: `Indiabulls Securities offers API-based algorithmic trading for advanced traders and developers.

Key features:
- REST API access for order placement, modification, and cancellation.
- WebSocket streaming for real-time market data (tick-by-tick).
- Support for equity, F&O, and currency segments.
- Paper trading / sandbox environment for testing strategies.

Getting started:
1. Apply for API access from your account settings or contact your relationship manager.
2. Generate your API key and secret from the developer portal.
3. Use the provided SDK (Python/Java/Node.js) or integrate directly with REST APIs.
4. Authenticate using OAuth2 and begin placing orders programmatically.

Rate limits and guidelines:
- Max orders per second: 10 (varies by plan).
- All algorithmic strategies must comply with SEBI's algo trading regulations.
- Co-location services are available for ultra-low latency requirements.`,
  },
  {
    id: 'sip',
    title: 'How to set up a SIP in Mutual Funds?',
    meta: 'Mutual Funds · 2 min read',
    content: `Setting up a Systematic Investment Plan (SIP) through Indiabulls Securities:

1. Go to Mutual Funds section in the app.
2. Search for the fund you want to invest in (e.g., Nifty 50 Index Fund, ELSS fund).
3. Click "Invest" → Select "SIP".
4. Enter the monthly SIP amount (minimum ₹500 for most funds).
5. Choose the SIP date (1st, 5th, 10th, 15th, 20th, or 25th of the month).
6. Select your bank account and payment method (UPI / Net Banking).
7. Confirm and activate the SIP.

Key points:
- SIPs are auto-debited on the chosen date every month.
- You can pause or cancel a SIP anytime from the Mutual Funds dashboard.
- ELSS SIPs qualify for tax deduction under Section 80C (up to ₹1.5 lakh/year).
- Growth and IDCW (dividend) plan options available.`,
  },
  {
    id: 'withdraw',
    title: 'How long does fund withdrawal take?',
    meta: 'Funds · 1 min read · 3.4k views',
    content: `Fund withdrawal timelines from Indiabulls Securities:

- Instant Withdrawal (up to a limit): Available 24×7. Funds credited to your bank within minutes.
- Normal Withdrawal: Processed within the same day if requested before 3:30 PM on trading days. Credited to your bank account by next business day (T+1).
- Weekend/Holiday requests: Processed on the next working day.

Steps to withdraw:
1. Go to Funds → Withdraw.
2. Enter the amount (must not exceed your withdrawable balance — unsettled credits are excluded).
3. Confirm your bank account and submit.

Note: Funds from equity delivery sales are available for withdrawal after T+1 settlement. F&O proceeds are available after T+1 as well.`,
  },
  {
    id: 'ipo2',
    title: 'How to apply for an IPO through Indiabulls Securities?',
    meta: 'Advanced · 3 min read',
    content: `You can apply for IPOs through Indiabulls Securities using ASBA (Application Supported by Blocked Amount):

Method 1 — via App/Web:
1. Open the IPO section and select the live IPO.
2. Enter bid details (lots, price, UPI ID).
3. Approve the UPI mandate — funds are blocked until allotment.

Method 2 — via Net Banking ASBA:
1. Log in to your bank's net banking portal.
2. Go to the IPO/ASBA section.
3. Enter your DP ID, client ID, and bid details.
4. Funds are blocked directly from your bank account.

After allotment:
- If allotted: Shares are credited to your Demat account and funds are debited on listing day.
- If not allotted: Blocked funds are released within 6 working days.

Tip: Use the cut-off price option for retail investors to maximise allotment chances.`,
  },
];


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// Local search index — covers all articles across the portal
const LOCAL_SEARCH_INDEX = [
  { id: 'acc-open', title: 'How to Open Demat account in Indiabulls Securities?', category: 'Account Opening' },
  { id: 'gtt', title: 'How to place a GTT (Good Till Trigger) order?', category: 'Trading' },
  { id: 'add-funds', title: 'How to add funds to my trading account?', category: 'Funds' },
  { id: 'tpin', title: 'How to generate and use CDSL TPIN for selling shares?', category: 'Compliance & Safety' },
  { id: 'brokerage', title: 'What are Indiabulls Securities brokerage charges and pricing plans?', category: 'Charges & Brokerage' },
  { id: 'ipo-apply', title: 'How to apply for an IPO via UPI mandate?', category: 'IPO' },
  { id: 'fo-ban', title: 'What is the F&O Ban Period and why does it happen?', category: 'F&O' },
  { id: 'basket', title: 'How to execute a Basket Order?', category: 'Trading' },
  { id: 'tax-pl', title: 'How to download my Tax P&L statement for ITR filing?', category: 'Reports' },
  { id: 'algo', title: 'What is Indiabulls Securities Algo and how to use it?', category: 'Advanced' },
  { id: 'sip', title: 'How to set up a SIP in Mutual Funds?', category: 'Mutual Funds' },
  { id: 'withdraw', title: 'How long does fund withdrawal take?', category: 'Funds' },
  { id: 'gs-open-account', title: 'How do I open an account with Indiabulls Securities?', category: 'Getting Started' },
  { id: 'gs-kyc', title: 'What documents are required for KYC?', category: 'Getting Started' },
  { id: 'gs-activate', title: 'How long does account activation take?', category: 'Getting Started' },
  { id: 'trading-buy-sell', title: 'How do I place a buy or sell order?', category: 'Trading' },
  { id: 'trading-gtt', title: 'What is a GTT order and how do I use it?', category: 'Trading' },
  { id: 'trading-types', title: 'What order types are available?', category: 'Trading' },
  { id: 'trading-basket', title: 'How to execute a Basket Order?', category: 'Trading' },
  { id: 'funds-add', title: 'How do I add funds to my trading account?', category: 'Funds' },
  { id: 'funds-withdraw', title: 'How do I withdraw funds?', category: 'Funds' },
  { id: 'funds-timing', title: 'When are funds credited after selling shares?', category: 'Funds' },
  { id: 'ipo-apply', title: 'How do I apply for an IPO?', category: 'IPO' },
  { id: 'ipo-allotment', title: 'How is IPO allotment decided?', category: 'IPO' },
  { id: 'ipo-cancel', title: 'Can I cancel my IPO application?', category: 'IPO' },
  { id: 'fo-activate', title: 'How do I activate F&O trading?', category: 'F&O' },
  { id: 'fo-margin', title: 'What is SPAN margin in F&O?', category: 'F&O' },
  { id: 'fo-expiry', title: 'What happens on F&O expiry day?', category: 'F&O' },
  { id: 'charges-brokerage', title: 'What are the brokerage charges?', category: 'Charges & Brokerage' },
  { id: 'charges-dp', title: 'What is DP (Depository Participant) charge?', category: 'Charges & Brokerage' },
  { id: 'account-password', title: 'How do I reset my trading password?', category: 'Account' },
  { id: 'account-nominee', title: 'How do I add or update a nominee?', category: 'Account' },
  { id: 'mtf-what', title: 'What is MTF (Margin Trade Funding)?', category: 'MTF' },
  { id: 'pledging-how', title: 'How do I pledge shares for margin?', category: 'Pledging' },
  { id: 'mf-invest', title: 'How do I invest in Mutual Funds?', category: 'Mutual Funds' },
  { id: 'compliance-2fa', title: 'How do I enable two-factor authentication?', category: 'Compliance & Safety' },
  { id: 'reports-pl', title: 'Where can I view my P&L report?', category: 'Reports' },
  { id: 'kyc-update', title: 'How do I update my KYC details?', category: 'KYC' },
  { id: 'contact-escalate', title: 'How do I escalate a complaint?', category: 'Contact & Escalation' },
  { id: 'nri-account', title: 'Can NRIs open a trading account?', category: 'NRI/HUF Accounts' },
  { id: 'tender-offer', title: 'How do I participate in a Tender Offer / Buyback?', category: 'Tender Offers' },
];

const CATEGORY_TO_SLUG: Record<string, string> = {
  'Getting Started': 'getting-started',
  'Account Opening': 'account-opening',
  'Trading': 'trading',
  'Funds': 'funds',
  'IPO': 'ipo',
  'F&O': 'fo',
  'Charges & Brokerage': 'charges',
  'Compliance & Safety': 'compliance',
  'Mutual Funds': 'mutual-funds',
  'Account': 'account',
  'Reports': 'reports',
  'MTF': 'mtf',
  'Pledging': 'pledging',
  'KYC': 'kyc',
  'Contact & Escalation': 'contact-faq',
  'NRI/HUF Accounts': 'nri',
  'Tender Offers': 'tender-offers',
  'Advanced': 'advanced',
};

function PopularArticleRow({ article }: { article: typeof POPULAR_ARTICLES[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="article-row" id={`pop-${article.id}`} style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default', padding: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '1rem 1.25rem', textAlign: 'left' }}
      >
        <div className="article-row-text">
          <h4>{article.title}</h4>
          <span>{article.meta}</span>
        </div>
        <i className={`fas fa-chevron-${open ? 'down' : 'right'}`} style={{ flexShrink: 0, marginLeft: '1rem', transition: 'transform 0.2s' }}></i>
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border)', marginTop: 0 }}>
          <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--text-mid)', marginTop: '1rem' }}>{article.content}</p>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ title: string; category: string; id: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const ql = q.toLowerCase();
    setLoading(true);
    try {
      // Try API first, fall back to local index
      let articles: { id: string; title: string; category: string }[] = [];
      try {
        const res = await fetch(`${API_BASE}/faq`);
        if (res.ok) {
          const data = await res.json();
          articles = Array.isArray(data) ? data : (data.items || data.articles || []);
        }
      } catch { /* use local */ }

      if (articles.length === 0) articles = LOCAL_SEARCH_INDEX;

      const filtered = articles.filter((a) =>
        a.title?.toLowerCase().includes(ql) ||
        a.category?.toLowerCase().includes(ql)
      ).slice(0, 8);
      setResults(filtered);
      setShowDropdown(filtered.length > 0);
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
              {results.map((article, i) => {
                const slug = CATEGORY_TO_SLUG[article.category] || article.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                return (
                  <Link
                    key={i}
                    href={`/faq/?cat=${slug}`}
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
                );
              })}
              <Link
                href={`/faq/?q=${encodeURIComponent(query)}`}
                className="search-result-item"
                style={{ borderTop: '1px solid var(--border)', justifyContent: 'center', color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}
                onClick={() => { setQuery(''); setResults([]); setShowDropdown(false); }}
              >
                <i className="fas fa-search" style={{ marginRight: '0.5rem' }}></i>
                View all results for &ldquo;{query}&rdquo;
              </Link>
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
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00AB4E' }}><i className="fas fa-rocket"></i></div>
              <div>
                <h3>Getting Started</h3>
                <p>Account, KYC, first trade</p>
              </div>
            </Link>
            <Link href="/faq?cat=account-opening" className="cat-card" id="cat-account-opening">
              <div className="cat-icon" style={{ background: '#E6FAE6', color: '#00AB4E' }}><i className="fas fa-id-card"></i></div>
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
            {POPULAR_ARTICLES.map((article) => (
              <PopularArticleRow key={article.id} article={article} />
            ))}
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
