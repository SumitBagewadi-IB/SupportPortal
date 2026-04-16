/* ============================================
   Indiabulls Securities Support — app.js
   Handles: article accordions, sidebar filter,
            category URL params, demo modal, search
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

    /* ─────────────────────────────────────────
       1. DEMO MODAL
    ───────────────────────────────────────── */
    const modal = document.getElementById('demoModal');
    const media = document.getElementById('demoMedia');
    const title = document.getElementById('modalTitle');
    const closeBtn = document.getElementById('closeModal');

    function openDemo(src, ttl) {
        if (!modal || !media) return;
        media.src = src;
        if (title) title.textContent = ttl || 'Feature Demo';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeDemo() {
        if (!modal) return;
        modal.classList.remove('active');
        if (media) media.src = '';
        document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDemo);
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeDemo(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDemo(); });

    // Attach demo buttons (works on both pages)
    document.querySelectorAll('[data-demo]').forEach(btn => {
        btn.addEventListener('click', () => openDemo(btn.dataset.demo, btn.dataset.title));
    });

    // Also allow clicking article screenshots to open modal
    document.querySelectorAll('.article-screenshot').forEach(img => {
        img.addEventListener('click', () => openDemo(img.src, img.alt));
    });

    /* ─────────────────────────────────────────
       2a. ARTICLE FEEDBACK LOGIC
    ───────────────────────────────────────── */
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger accordion toggle
            const container = btn.closest('.article-feedback');
            const buttons = container.querySelector('.feedback-buttons');
            const thanks = container.querySelector('.feedback-thanks');

            // UI Update
            buttons.style.display = 'none';
            if (thanks) thanks.style.display = 'block';

            // Optional: Send to analytics/server
            console.log('Feedback received:', btn.dataset.type);
        });
    });

    /* ─────────────────────────────────────────
       2. ARTICLE ACCORDIONS (faq.html)
    ───────────────────────────────────────── */
    document.querySelectorAll('.article-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const body = trigger.nextElementSibling;
            const isOpen = trigger.classList.contains('open');

            // Close all others
            document.querySelectorAll('.article-trigger.open').forEach(t => {
                t.classList.remove('open');
                if (t.nextElementSibling) t.nextElementSibling.classList.remove('open');
            });

            // Toggle current
            if (!isOpen) {
                trigger.classList.add('open');
                if (body) body.classList.add('open');
            }
        });
    });

    /* ─────────────────────────────────────────
       3. SIDEBAR CATEGORY FILTER (faq.html)
    ───────────────────────────────────────── */
    const sidebar = document.getElementById('kbSidebar');
    const heading = document.getElementById('kbHeading');
    const subheading = document.getElementById('kbSubheading');

    const catMeta = {
        'all': { label: 'All Topics', sub: 'Browse all support articles or filter by topic from the sidebar.' },
        'getting-started': { label: 'Getting Started', sub: 'Quick guides to navigate the platform and place your first trade.' },
        'account-opening': { label: 'Account Opening', sub: 'Step-by-step guide to opening your Shubh account, documentation, and activation.' },
        'trading': { label: 'Trading', sub: 'Orders, GTT, Basket, Cover Orders and execution queries.' },
        'portfolio': { label: 'Portfolio', sub: 'Track P&L, holdings, positions and margin pledging.' },
        'funds': { label: 'Funds', sub: 'Add, withdraw funds and understand your ledger balance.' },
        'advanced': { label: 'Advanced Features', sub: 'Algo trading, IPOs, Mutual Funds and Smart Baskets.' },
        'account': { label: 'Account & Settings', sub: 'Profile, segments, nominees and subscription plans.' },
        'reports': { label: 'Reports', sub: 'Download Tax P&L, contract notes and audit statements.' },
        'charges': { label: 'Charges & Brokerage', sub: 'Brokerage plans, STT, GST, DP charges and other statutory levies.' },
        'compliance': { label: 'Compliance & Safety', sub: 'TPIN, eDIS, T2T stocks, ASM/GSM and 2FA security.' },
        'mutual-funds': { label: 'Mutual Funds', sub: 'SIP, lump sum, ELSS, redemptions and NAV timelines.' },
        'nri': { label: 'NRI / HUF Accounts', sub: 'Account types, PIS, NRE/NRO and documentation for non-individuals.' },
        'pro-market': { label: 'Advanced Market Analysis', sub: 'Visualise market breadth, heatmaps, and identify stocks hitting intraday highs.' },
        'pro-charts': { label: 'Professional Charting', sub: 'Master TradingView layouts, synchronized multi-chart windows, and studies.' },
        'pro-algo': { label: 'Algo Trading & API access', sub: 'Connect external tools like TradingView or Python SDK to Indiabulls Securities execution.' },
        'ipo': { label: 'IPO', sub: 'Apply for Initial Public Offerings, check allotment status, and listing dates.' },
        'fo': { label: 'Futures & Options', sub: 'Master F&O trading, margins, lot sizes, and contract expiry details.' },
        'pledging': { label: 'Pledging & Collateral', sub: 'Pledge your holdings for collateral margin and understand haircut rules.' },
        'contact-faq': { label: 'Contact & Escalation', sub: 'Ways to reach our support team, registered addresses, and escalation matrix.' },
        'kyc': { label: 'KYC Process', sub: 'Everything about Know Your Customer requirements, document submission, and verification timelines.' },
    };

    function filterByCategory(cat) {
        const groups = document.querySelectorAll('.article-group');
        groups.forEach(g => {
            g.style.display = (cat === 'all' || g.dataset.cat === cat) ? '' : 'none';
        });

        // Update heading
        const meta = catMeta[cat] || catMeta['all'];
        if (heading) heading.textContent = meta.label;
        if (subheading) subheading.textContent = meta.sub;

        // Update active sidebar link
        if (sidebar) {
            sidebar.querySelectorAll('.kb-nav-link').forEach(l => {
                l.classList.toggle('active', l.dataset.cat === cat);
            });
        }

        // Update URL param without reload
        const url = new URL(window.location);
        url.searchParams.set('cat', cat);
        window.history.replaceState({}, '', url);
    }

    if (sidebar) {
        sidebar.querySelectorAll('.kb-nav-link').forEach(btn => {
            btn.addEventListener('click', () => filterByCategory(btn.dataset.cat));
        });

        // honour URL param on load
        const params = new URLSearchParams(window.location.search);
        const initCat = params.get('cat') || 'all';
        filterByCategory(initCat);

        // honour hash anchors — open the matching article
        if (window.location.hash) {
            const target = document.querySelector(window.location.hash + ' .article-trigger');
            if (target) {
                setTimeout(() => {
                    target.click();
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }

    /* ─────────────────────────────────────────
       4. CENTRALIZED ARTICLE REGISTRY
    ───────────────────────────────────────── */
    const articles = [
        { id: 'acc-send-docs', title: 'Will Indiabulls Securities Ltd send any documents to my address?', desc: 'Physical document policy', cat: 'account-opening', icon: 'fa-envelope-open-text', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-platforms', title: 'What kind of trading platforms are offered?', desc: 'Web and mobile app access', cat: 'account-opening', icon: 'fa-laptop-code', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-call-trade', title: 'Can orders be placed by calling?', desc: 'Call & Trade facility charges', cat: 'account-opening', icon: 'fa-phone-volume', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-no-demat', title: 'Can a trading account be opened without demat?', desc: 'Demat account essentiality', cat: 'account-opening', icon: 'fa-folder-tree', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-map-demat', title: 'Can external demat accounts be mapped?', desc: 'External DP mapping policy', cat: 'account-opening', icon: 'fa-link-slash', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-how-many', title: 'How many Demat accounts can I open?', desc: 'Multiple account policy', cat: 'account-opening', icon: 'fa-user-plus', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-how-to-open', title: 'How to Open Demat account?', desc: '8-step account opening guide', cat: 'account-opening', icon: 'fa-id-card', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-time', title: 'How much time does it take to open an account?', desc: 'Activation timelines', cat: 'account-opening', icon: 'fa-hourglass-half', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-charges', title: 'Charges for opening an account?', desc: 'Free account opening details', cat: 'account-opening', icon: 'fa-coins', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-ap', title: 'What is Authorised Person (AP)?', desc: 'AP role and SEBI regulations', cat: 'account-opening', icon: 'fa-user-tie', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-amc', title: 'What are Annual Maintenance Charges (AMC)?', desc: 'Individual vs Corporate AMC', cat: 'account-opening', icon: 'fa-calendar-check', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-docs-req', title: 'Documents required for account opening?', desc: 'PAN, Aadhaar, Bank, Income proof', cat: 'account-opening', icon: 'fa-file-signature', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-who-can', title: 'Who can open an account on Indiabulls Securities India?', desc: 'Eligibility for retail and business', cat: 'account-opening', icon: 'fa-users', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-nri', title: 'Are NRIs allowed to open an account?', desc: 'NRI trading and demat access', cat: 'account-opening', icon: 'fa-globe', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-products', title: 'Which segments are available?', desc: 'Equity, F&O, Currency, Commodities', cat: 'account-opening', icon: 'fa-cubes', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-corporate', title: 'Can a Company/Corporate open an account?', desc: 'Non-individual account types', cat: 'account-opening', icon: 'fa-building', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-fo-status', title: 'My F&O Income Proof has been uploaded. Status?', desc: 'F&O activation timeline', cat: 'account-opening', icon: 'fa-file-shield', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-fo-docs', title: 'Documents required to activate F&O?', desc: 'Accepted income proofs', cat: 'account-opening', icon: 'fa-paperclip', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-pan-fail', title: 'Why was my PAN verification failed?', desc: 'Mismatch issues and solutions', cat: 'account-opening', icon: 'fa-id-card-clip', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-sig-reject', title: 'Why was my Signature rejected?', desc: 'Image clarity and rejection reasons', cat: 'account-opening', icon: 'fa-pencil-alt', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-fees', title: 'Account opening fees?', desc: 'Zero cost account opening', cat: 'account-opening', icon: 'fa-tags', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-name-mismatch', title: 'Mismatch in name during KYC?', desc: 'Name format in registration', cat: 'account-opening', icon: 'fa-user-tag', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-esign', title: 'What is eSign in KYC?', desc: 'Aadhaar-based digital signature', cat: 'account-opening', icon: 'fa-signature', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },
        { id: 'acc-ipv', title: 'What is In-Person Verification (IPV)?', desc: 'Video KYC process', cat: 'account-opening', icon: 'fa-video', color: '#00C805', bg: '#E6FAE6', tier: 'basic' },

        // NRI & Account Types
        { id: 'acc-nri-transfer', title: 'How can NRIs transfer shares?', desc: 'Process for NRE/NRO transfers', cat: 'nri', icon: 'fa-exchange-alt', color: '#7C3AED', bg: '#F5F3FF', tier: 'pro' },
        { id: 'acc-trust-docs', title: 'Procedure for Trust account?', desc: 'Offline registration for Trusts', cat: 'nri', icon: 'fa-landmark', color: '#7C3AED', bg: '#F5F3FF', tier: 'pro' },
        { id: 'acc-nro-open', title: 'How to open NRO account?', desc: 'Checklist for NRO accounts', cat: 'nri', icon: 'fa-passport', color: '#7C3AED', bg: '#F5F3FF', tier: 'pro' },
        { id: 'acc-huf-open', title: 'How to open HUF account?', desc: 'HUF registration guide', cat: 'nri', icon: 'fa-users-rectangle', color: '#7C3AED', bg: '#F5F3FF', tier: 'pro' },
        { id: 'acc-corporate-full', title: 'Corporate Account docs?', desc: 'Company registration proofs', cat: 'nri', icon: 'fa-building', color: '#7C3AED', bg: '#F5F3FF', tier: 'pro' },

        // Account Management
        { id: 'acc-commodity-open', title: 'How to open a commodity account?', desc: 'MCX segment activation', cat: 'account', icon: 'fa-wheat-awn', color: '#22C55E', bg: '#F0FDF4', tier: 'basic' },
        { id: 'acc-demo', title: 'Demo account for paper trading?', desc: 'Paper trading availability', cat: 'account', icon: 'fa-vial', color: '#22C55E', bg: '#F0FDF4', tier: 'basic' },

        // Charges & Brokerage
        { id: 'charge-brokerage', title: 'Brokerage charges at Indiabulls?', desc: 'Flat ₹20 plan details', cat: 'charges', icon: 'fa-tags', color: '#D97706', bg: '#FFFBEB', tier: 'basic' },
        { id: 'charge-call-trade', title: 'Call & Trade charges?', desc: 'Phone order fee details', cat: 'charges', icon: 'fa-phone-volume', color: '#D97706', bg: '#FFFBEB', tier: 'basic' },
        { id: 'charge-netbanking', title: 'Net Banking charges?', desc: 'Transfer fee of ₹10', cat: 'charges', icon: 'fa-building-columns', color: '#D97706', bg: '#FFFBEB', tier: 'basic' },

        // Compliance
        { id: 'kyc-timeline', title: 'KYC approval timeline?', desc: 'Verification turnaround time', cat: 'compliance', icon: 'fa-clock', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'kyc-bank-verify', title: 'Bank account verification?', desc: 'Penny drop check process', cat: 'compliance', icon: 'fa-bank', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'compliance-tpin', title: 'What is CDSL TPIN?', desc: 'Authorize share selling securely', cat: 'compliance', icon: 'fa-lock', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'compliance-edis', title: 'What is eDIS authorization?', desc: 'Electronic sell authorization', cat: 'compliance', icon: 'fa-file-signature', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'compliance-nominee', title: 'How to add a Nominee?', desc: 'Digital nomination process', cat: 'compliance', icon: 'fa-user-plus', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },

        // Mutual Funds
        { id: 'mf-how-to', title: 'Invest in Mutual Funds?', desc: 'SIP and Lump sum guide', cat: 'mutual-funds', icon: 'fa-seedling', color: '#10B981', bg: '#ECFDF5', tier: 'basic' },
        { id: 'mf-cutoff', title: 'NAV cut-off time?', desc: 'Order timing for same-day NAV', cat: 'mutual-funds', icon: 'fa-hourglass-half', color: '#10B981', bg: '#ECFDF5', tier: 'basic' },
        { id: 'mf-sip-mandate', title: 'What is a SIP Mandate?', desc: 'Automatic debit instructions', cat: 'mutual-funds', icon: 'fa-file-signature', color: '#10B981', bg: '#ECFDF5', tier: 'basic' },
        { id: 'mf-redeem', title: 'How to redeem Mutual Funds?', desc: 'Redemption process and TAT', cat: 'mutual-funds', icon: 'fa-money-bill-transfer', color: '#10B981', bg: '#ECFDF5', tier: 'basic' },

        // More Account Updates
        { id: 'acc-bank-update', title: 'Update bank account?', desc: 'Change primary or secondary bank', cat: 'account', icon: 'fa-university', color: '#22C55E', bg: '#F0FDF4', tier: 'basic' },
        { id: 'acc-close', title: 'How to close my account?', desc: 'Demat account closure process', cat: 'account', icon: 'fa-user-slash', color: '#22C55E', bg: '#F0FDF4', tier: 'basic' },
        { id: 'acc-dormant', title: 'Reactivate dormant account?', desc: 'Re-KYC for inactive accounts', cat: 'account', icon: 'fa-user-clock', color: '#22C55E', bg: '#F0FDF4', tier: 'basic' },

        { id: 'report-tax-pnl', title: 'Download Tax P&L?', desc: 'Statements for tax filing', cat: 'reports', icon: 'fa-file-invoice-dollar', color: '#6366F1', bg: '#EEF2FF', tier: 'basic' },

        { id: 'trade-ipo-apply', title: 'How to apply for IPO?', desc: 'UPI-based IPO application', cat: 'advanced', icon: 'fa-rocket', color: '#A855F7', bg: '#FAF5FF', tier: 'basic' },
        { id: 'trade-mtf-intro', title: 'What is MTF?', desc: 'Margin Trading Facility guide', cat: 'advanced', icon: 'fa-landmark', color: '#A855F7', bg: '#FAF5FF', tier: 'pro' },

        { id: 'gtt', title: 'How to place a GTT (Good Till Trigger) order?', desc: 'Set price alerts, long-term orders', cat: 'trading', icon: 'fa-clock', color: '#3B82F6', bg: '#EFF6FF', tier: 'pro' },
        { id: 'basket', title: 'How to execute a Basket Order?', desc: 'Execute multiple trades at once', cat: 'trading', icon: 'fa-shopping-basket', color: '#3B82F6', bg: '#EFF6FF', tier: 'pro' },
        { id: 'add-funds', title: 'How to add funds to my account?', desc: 'UPI, Net Banking, instant credit', cat: 'funds', icon: 'fa-wallet', color: '#A855F7', bg: '#FAF5FF', tier: 'basic' },
        { id: 'withdraw', title: 'How long does fund withdrawal take?', desc: 'RTP withdrawals, 30 min processing', cat: 'funds', icon: 'fa-money-bill-wave', color: '#A855F7', bg: '#FAF5FF', tier: 'basic' },
        { id: 'algo', title: 'What is IB Algo and how to use it?', desc: 'Automated strategies, QuantMan', cat: 'advanced', icon: 'fa-robot', color: '#F43F5E', bg: '#FFF1F2', tier: 'pro' },
        { id: 'ipo', title: 'How to apply for an IPO?', desc: 'UPI bidding, active IPOs', cat: 'advanced', icon: 'fa-rocket', color: '#F43F5E', bg: '#FFF1F2', tier: 'pro' },
        { id: 'intraday', title: 'Understanding Intraday Leverage', desc: 'MIS orders, 5x leverage', cat: 'portfolio', icon: 'fa-bolt', color: '#F59E0B', bg: '#FFFBEB', tier: 'basic' },
        { id: 'mtf', title: 'MTF (Margin Trading Facility) Guide', desc: 'Hold leveraged positions long term', cat: 'trading', icon: 'fa-layer-group', color: '#F59E0B', bg: '#FFFBEB', tier: 'pro' },
        { id: 'trading-mis', title: 'What is MIS order?', desc: 'Intraday square-off orders', cat: 'trading', icon: 'fa-clock-rotate-left', color: '#3B82F6', bg: '#EFF6FF', tier: 'basic' },
        { id: 'trading-cnc', title: 'What is CNC order?', desc: 'Cash and Carry (Delivery)', cat: 'trading', icon: 'fa-briefcase', color: '#3B82F6', bg: '#EFF6FF', tier: 'basic' },
        { id: 'trading-sl', title: 'Stop Loss (SL) vs SL-M?', desc: 'Limit vs Market SL orders', cat: 'trading', icon: 'fa-shield-halved', color: '#3B82F6', bg: '#EFF6FF', tier: 'basic' },
        { id: 'pro-market', title: 'How to use Market Heatmaps & Stats?', desc: 'Visualise market breadth', cat: 'pro-market', icon: 'fa-chart-pie', color: '#C2410C', bg: '#FFF7ED', tier: 'pro' },
        { id: 'pro-charts', title: 'Multi-Chart Layouts & TradingView', desc: 'Sync multi-chart windows', cat: 'pro-charts', icon: 'fa-wave-square', color: '#C2410C', bg: '#FFF7ED', tier: 'pro' },
        { id: 'pro-algo', title: 'Trading Webhooks & External Integration', desc: 'Connect TradingView alerts', cat: 'pro-algo', icon: 'fa-terminal', color: '#C2410C', bg: '#FFF7ED', tier: 'pro' },

        // IPO Segment
        { id: 'ipo-what-is', title: 'What is an IPO?', desc: 'Initial Public Offering basics', cat: 'ipo', icon: 'fa-rocket', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'ipo-apply', title: 'How to apply for an IPO?', desc: 'Step-by-step UPI guide', cat: 'ipo', icon: 'fa-rocket', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'ipo-allotment', title: 'How to check IPO Allotment?', desc: 'Registry link and checking process', cat: 'ipo', icon: 'fa-calendar-check', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },
        { id: 'ipo-max-limit', title: 'Maximum amount to invest in IPO?', desc: 'Retail vs HNI limits', cat: 'ipo', icon: 'fa-coins', color: '#F43F5E', bg: '#FFF1F2', tier: 'basic' },

        // F&O Segment
        { id: 'fo-what-is', title: 'Common F&O Terms', desc: 'Lot size, expiry, strike price', cat: 'fo', icon: 'fa-bolt', color: '#F59E0B', bg: '#FFFBEB', tier: 'basic' },
        { id: 'fo-margin', title: 'Margin for Options trading?', desc: 'Buying vs Selling margins', cat: 'fo', icon: 'fa-wallet', color: '#F59E0B', bg: '#FFFBEB', tier: 'basic' },
        { id: 'fo-ban', title: 'What is F&O Ban Period?', desc: 'Position limits and bans', cat: 'fo', icon: 'fa-ban', color: '#F59E0B', bg: '#FFFBEB', tier: 'basic' },
        { id: 'fo-activation', title: 'How to enable F&O segment?', desc: 'Activation via income proof', cat: 'fo', icon: 'fa-file-invoice-dollar', color: '#F59E0B', bg: '#FFFBEB', tier: 'basic' },

        // Pledging Segment
        { id: 'pledge-what-is', title: 'What is Pledging of shares?', desc: 'Use holdings for margin', cat: 'pledging', icon: 'fa-link', color: '#0F172A', bg: '#F1F5F9', tier: 'basic' },
        { id: 'pledge-charges', title: 'Pledging & Unpledging charges?', desc: '₹35 per scrip fee', cat: 'pledging', icon: 'fa-dollar-sign', color: '#0F172A', bg: '#F1F5F9', tier: 'basic' },
        { id: 'pledge-haircut', title: 'What is Haircut in Pledge?', desc: 'Margin discount rules', cat: 'pledging', icon: 'fa-cut', color: '#0F172A', bg: '#F1F5F9', tier: 'basic' },
        { id: 'pledge-unpledge', title: 'How to Unpledge shares?', desc: 'Release collateral process', cat: 'pledging', icon: 'fa-unlock', color: '#0F172A', bg: '#F1F5F9', tier: 'basic' },

        // Contact Segment
        { id: 'contact-address', title: 'Registered Office Address', desc: 'Head office & Correspondence', cat: 'contact-faq', icon: 'fa-map-marker-alt', color: '#6366F1', bg: '#EEF2FF', tier: 'basic' },
        { id: 'contact-support', title: 'How to reach Support?', desc: 'Email, Call & Timings', cat: 'contact-faq', icon: 'fa-headset', color: '#6366F1', bg: '#EEF2FF', tier: 'basic' },
        { id: 'contact-call-trade', title: 'Call & Trade Numbers', desc: 'Manual order placement desk', cat: 'contact-faq', icon: 'fa-phone-volume', color: '#6366F1', bg: '#EEF2FF', tier: 'basic' },

        // Advanced Orders
        { id: 'trading-iceberg', title: 'How to use Iceberg Orders?', desc: 'Large order execution strategies', cat: 'trading', icon: 'fa-icicles', color: '#3B82F6', bg: '#EFF6FF', tier: 'pro' },

        // Tender Offers
        { id: 'tender-what-is', title: 'What is a Tender Offer?', desc: 'Buybacks and OFS basics', cat: 'tender-offers', icon: 'fa-hand-holding-dollar', color: '#0284C7', bg: '#F0F9FF', tier: 'basic' },
        { id: 'tender-apply', title: 'How to participate in Buybacks?', desc: 'Participate in corporate actions', cat: 'tender-offers', icon: 'fa-check-to-slot', color: '#0284C7', bg: '#F0F9FF', tier: 'basic' },
    ];

    function updateSidebarCounts() {
        const counts = {
            'all': articles.length,
            'getting-started': 0, 'account-opening': 0, 'trading': 0, 'portfolio': 0, 'funds': 0,
            'advanced': 0, 'account': 0, 'reports': 0, 'charges': 0, 'compliance': 0,
            'mutual-funds': 0, 'nri': 0, 'ipo': 0, 'fo': 0, 'pledging': 0, 'contact-faq': 0, 'tender-offers': 0, 'mtf': 0,
            'kyc': 0
        };

        articles.forEach(a => { if (counts[a.cat] !== undefined) counts[a.cat]++; });

        const idMap = {
            'all': 'count-all', 'getting-started': 'count-gs', 'account-opening': 'count-ao', 'trading': 'count-tr',
            'portfolio': 'count-pf', 'funds': 'count-fn', 'advanced': 'count-adv',
            'account': 'count-acc', 'reports': 'count-rp',
            'pro-market': 'count-pro-m', 'pro-charts': 'count-pro-c', 'pro-algo': 'count-pro-a',
            'compliance': 'count-comp', 'mutual-funds': 'count-mf', 'nri': 'count-nri', 'charges': 'count-ch',
            'ipo': 'count-ipo', 'fo': 'count-fo', 'pledging': 'count-pledge', 'contact-faq': 'count-cf',
            'mtf': 'count-mtf', 'tender-offers': 'count-tender', 'kyc': 'count-kyc'
        };

        Object.keys(idMap).forEach(cat => {
            const el = document.getElementById(idMap[cat]);
            if (el) el.textContent = counts[cat];
        });
    }

    updateSidebarCounts();

    /* ─────────────────────────────────────────
       CMS STATUS: Hide pending articles on public faq.html
       + fetch live articles from DynamoDB API
    ───────────────────────────────────────── */
    (function applyPublicCmsVisibility() {
        // Only run on the public FAQ page (not admin)
        if (!document.getElementById('articleContainer')) return;

        const API_BASE = 'https://un1k0vx0ij.execute-api.ap-south-1.amazonaws.com/uat';

        // Inject a single DynamoDB article card into the correct group
        function injectDynamoArticle(article) {
            if (!article.id || !article.question || !article.status || article.status !== 'approved') return;
            if (document.getElementById(article.id)) return; // already exists (static or duplicate)

            const groups = document.querySelectorAll('.article-group');
            let targetGroup = null;
            groups.forEach(g => { if (g.dataset.cat === article.category) targetGroup = g; });
            if (!targetGroup) return;

            const cardHtml = `
            <div class="article-card" id="${article.id}" data-status="approved" data-source="dynamodb">
                <button class="article-trigger">
                    <div class="article-trigger-left">
                        <span class="article-cat-dot"></span>
                        <div>
                            <h3>${article.question}</h3>
                            <p>${article.summary || ''}</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down article-chevron"></i>
                </button>
                <div class="article-body">
                    <p>${article.answer || ''}</p>
                </div>
            </div>`;
            targetGroup.insertAdjacentHTML('beforeend', cardHtml);

            const newCard = document.getElementById(article.id);
            if (newCard) {
                const trigger = newCard.querySelector('.article-trigger');
                if (trigger) {
                    trigger.addEventListener('click', () => {
                        const body = trigger.nextElementSibling;
                        const isOpen = trigger.classList.contains('open');
                        document.querySelectorAll('.article-trigger.open').forEach(t => {
                            t.classList.remove('open');
                            if (t.nextElementSibling) t.nextElementSibling.classList.remove('open');
                        });
                        if (!isOpen) {
                            trigger.classList.add('open');
                            if (body) body.classList.add('open');
                        }
                    });
                }
            }
        }

        // Fetch live articles from DynamoDB
        fetch(API_BASE + '/faq')
            .then(r => r.ok ? r.json() : [])
            .then(items => { items.forEach(injectDynamoArticle); })
            .catch(() => {}); // silently degrade — static content still works

        const disabledCategories = JSON.parse(localStorage.getItem('cms_categories') || '{}');

        document.querySelectorAll('.article-card').forEach(card => {
            const cardId = card.id;
            if (!cardId) return; // skip if no ID somehow

            // Check category-level disable
            const group = card.closest('.article-group');
            if (group) {
                const cat = group.dataset.cat;
                if (disabledCategories[cat] === false) {
                    card.style.display = 'none';
                    return;
                }
            }

            // Check article-level status override from CMS
            const storedStatus = localStorage.getItem('cms_status_' + cardId);
            const defaultStatus = card.dataset.status || 'approved';

            const effectiveStatus = storedStatus || defaultStatus;

            if (effectiveStatus === 'pending') {
                card.style.display = 'none';
            }
        });

    })();

    /* ─────────────────────────────────────────
       5. HOME PAGE SEARCH (index.html)
    ───────────────────────────────────────── */
    const globalSearch = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');

    if (globalSearch && searchResults) {
        globalSearch.addEventListener('input', () => {
            const query = globalSearch.value.trim().toLowerCase();
            if (query.length < 2) {
                searchResults.classList.remove('active');
                return;
            }

            const matches = articles.filter(a =>
                a.title.toLowerCase().includes(query) ||
                a.desc.toLowerCase().includes(query)
            );

            if (matches.length > 0) {
                searchResults.innerHTML = matches.map(a => `
                    <a href="faq.html?cat=${a.cat}#${a.id}" class="search-result-item">
                        <div class="search-result-icon" style="background: ${a.bg}; color: ${a.color};">
                            <i class="fas ${a.icon}"></i>
                        </div>
                        <div class="search-result-info">
                            <h4><span class="tier-badge badge-${a.tier}">${a.tier}</span> ${a.title}</h4>
                            <p>${a.cat.replace('-', ' ')} · ${a.desc}</p>
                        </div>
                    </a>
                `).join('');
                searchResults.classList.add('active');
            } else {
                searchResults.innerHTML = `
                    <div class="search-no-results">
                        <i class="fas fa-search"></i>
                        <p>No articles found for "<strong>${globalSearch.value}</strong>"</p>
                    </div>
                `;
                searchResults.classList.add('active');
            }
        });

        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!globalSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });

        globalSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = globalSearch.value.trim();
                if (q) window.location.href = 'faq.html?q=' + encodeURIComponent(q);
            }
        });
    }

    /* ─────────────────────────────────────────
       6. FAQ PAGE SEARCH (faq.html)
    ───────────────────────────────────────── */
    const faqSearch = document.getElementById('faqSearch');
    const articleCards = document.querySelectorAll('.article-card');

    function performFaqFilter(query) {
        const q = query.toLowerCase();
        let anyVisible = false;

        document.querySelectorAll('.article-group').forEach(group => {
            let groupVisible = false;
            group.querySelectorAll('.article-card').forEach(card => {
                const title = card.querySelector('h3').textContent.toLowerCase();
                const body = card.querySelector('.article-body').textContent.toLowerCase();

                if (title.includes(q) || body.includes(q)) {
                    card.style.display = '';
                    groupVisible = true;
                    anyVisible = true;
                } else {
                    card.style.display = 'none';
                }
            });
            group.style.display = groupVisible ? '' : 'none';
        });

        if (heading) {
            heading.textContent = q ? `Search: "${query}"` : 'All Topics';
        }
        if (subheading) {
            subheading.textContent = q
                ? (anyVisible ? 'Showing matching articles.' : 'No articles found. Try a different keyword.')
                : 'Browse all support articles or filter by topic from the sidebar.';
        }
    }

    if (faqSearch) {
        faqSearch.addEventListener('input', () => {
            performFaqFilter(faqSearch.value.trim());
        });

        // Initialize from URL param
        const urlParams = new URLSearchParams(window.location.search);
        const qParam = urlParams.get('q');
        if (qParam) {
            faqSearch.value = qParam;
            performFaqFilter(qParam);
        }
    }

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            document.documentElement.style.setProperty('--x', x + 'px');
            document.documentElement.style.setProperty('--y', y + 'px');

            const toggleTheme = () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const newTheme = isDark ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            };

            if (!document.startViewTransition) {
                toggleTheme();
                return;
            }

            document.startViewTransition(() => toggleTheme());
        });
    }

});
