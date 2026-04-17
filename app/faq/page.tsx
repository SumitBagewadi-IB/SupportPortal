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

const VALID_CATEGORIES = [
  'getting-started','account-opening','trading','portfolio','funds','ipo',
  'fo','pledging','account','reports','contact-faq','mtf','tender-offers',
  'kyc','charges','compliance','mutual-funds','nri','all',
];

const CATEGORIES = [
  { key: 'all', label: 'All Topics', icon: 'fas fa-border-all' },
  { key: 'getting-started', label: 'Getting Started', icon: 'fas fa-rocket' },
  { key: 'account-opening', label: 'Account Opening', icon: 'fas fa-id-card' },
  { key: 'trading', label: 'Trading', icon: 'fas fa-chart-line' },
  { key: 'portfolio', label: 'Portfolio', icon: 'fas fa-briefcase' },
  { key: 'funds', label: 'Funds', icon: 'fas fa-wallet' },
  { key: 'ipo', label: 'IPO', icon: 'fas fa-rocket' },
  { key: 'fo', label: 'F&O', icon: 'fas fa-bolt' },
  { key: 'pledging', label: 'Pledging', icon: 'fas fa-link' },
  { key: 'account', label: 'Account', icon: 'fas fa-user-circle' },
  { key: 'reports', label: 'Reports', icon: 'fas fa-file-invoice' },
  { key: 'contact-faq', label: 'Contact & Escalation', icon: 'fas fa-headset' },
  { key: 'mtf', label: 'MTF', icon: 'fas fa-layer-group' },
  { key: 'tender-offers', label: 'Tender Offers', icon: 'fas fa-hand-holding-dollar' },
  { key: 'kyc', label: 'KYC Process', icon: 'fas fa-fingerprint' },
  { key: 'charges', label: 'Charges & Brokerage', icon: 'fas fa-tags' },
  { key: 'compliance', label: 'Compliance & Safety', icon: 'fas fa-shield-halved' },
  { key: 'mutual-funds', label: 'Mutual Funds', icon: 'fas fa-seedling' },
  { key: 'nri', label: 'NRI / HUF Accounts', icon: 'fas fa-globe' },
];

// ─── Complete fallback article database covering all 19 categories ───────────
const FALLBACK_ARTICLES: Article[] = [
  // GETTING STARTED
  {
    id: 'gs-1', title: 'How do I get started with Indiabulls Securities?', category: 'Getting Started', status: 'published',
    content: `Welcome to Indiabulls Securities! Here's how to get started:\n\n1. Open Account: Visit indiabullssecurities.com and click "Open Account". The process is fully online and takes about 10–15 minutes.\n2. Complete KYC: Provide your PAN, Aadhaar, bank details, and a selfie for identity verification.\n3. Fund Your Account: Add money via UPI, Net Banking, or NEFT to start trading.\n4. Start Trading: Log in to the web platform or download the mobile app and place your first order.\n\nDocuments Required:\n- PAN Card\n- Aadhaar Card (for e-KYC)\n- Bank account with cheque/passbook copy\n- Signature scan\n\nYour account will be activated within 1–2 business days after successful verification.`,
  },
  {
    id: 'gs-2', title: 'What markets can I trade on Indiabulls Securities?', category: 'Getting Started', status: 'published',
    content: `Indiabulls Securities provides access to the following markets:\n\nEquity Markets:\n- NSE (National Stock Exchange)\n- BSE (Bombay Stock Exchange)\n- Equity Delivery, Intraday, and CNC orders\n\nDerivatives (F&O):\n- Futures and Options on NSE\n- Index and stock futures/options\n- Currency derivatives\n\nCommodities:\n- MCX (Multi Commodity Exchange)\n- NCDEX\n\nMutual Funds:\n- Direct and Regular plans\n- SIP and lump sum investments\n- 3000+ funds available\n\nIPO:\n- Apply for mainboard and SME IPOs\n- ASBA/UPI-based applications\n\nTrading Hours:\n- Equity/F&O: 9:15 AM – 3:30 PM (Mon–Fri)\n- Commodity: Varies by contract; MCX trades till 11:30 PM`,
  },
  {
    id: 'gs-3', title: 'How do I download and log in to the Indiabulls Securities app?', category: 'Getting Started', status: 'published',
    content: `Downloading the App:\n1. Android: Open Google Play Store → Search "Indiabulls Securities" → Download.\n2. iOS: Open App Store → Search "Indiabulls Securities" → Install.\n\nLogging In:\n1. Open the app.\n2. Enter your Client ID (provided in welcome email/SMS).\n3. Enter your password.\n4. Complete 2FA if enabled (OTP on registered mobile).\n\nFirst-time Login:\n- Use the temporary password sent to your registered email/mobile.\n- You will be prompted to change your password immediately.\n\nTrouble logging in?\n- Forgot password: Click "Forgot Password" and enter your Client ID or registered email to receive a reset link.\n- Account locked: Contact support at 022-61446300.`,
  },

  // ACCOUNT OPENING
  {
    id: 'ao-1', title: 'How to Open Demat account in Indiabulls Securities?', category: 'Account Opening', status: 'published',
    content: `To open a Demat account with Indiabulls Securities:\n\n1. Visit the Indiabulls Securities website and click "Open Account".\n2. Enter your mobile number and verify via OTP.\n3. Fill in your personal details — name, PAN, date of birth, and address.\n4. Complete e-KYC by uploading your Aadhaar, PAN card, and a selfie.\n5. Sign the application digitally using Aadhaar OTP-based e-Sign.\n6. Your account will be activated within 1–2 business days.\n\nRequirements:\n- PAN Card (mandatory)\n- Aadhaar Card (for e-KYC)\n- Bank account details\n- Mobile linked to Aadhaar\n\nFor NRI accounts, additional documents like PIO/OCI card and NRE/NRO bank account details are required.`,
  },
  {
    id: 'ao-2', title: 'How long does it take to activate my trading account?', category: 'Account Opening', status: 'published',
    content: `Account Activation Timeline:\n\n- Online (e-KYC): 1–2 business days after successful verification.\n- Offline (physical documents): 3–5 business days after receiving your documents.\n\nYou will receive activation confirmation via:\n- SMS on your registered mobile number\n- Email on your registered email ID\n- Your Client ID will be shared in the same communication\n\nIf your account is not activated within the expected time:\n1. Check your email/SMS for any pending document requests.\n2. Call our support line at 022-61446300.\n3. Email helpdesk@indiabullssecurities.com with your application reference number.\n\nNote: Accounts submitted on weekends or public holidays are processed on the next business day.`,
  },
  {
    id: 'ao-3', title: 'Can I open a joint Demat account?', category: 'Account Opening', status: 'published',
    content: `Yes, Indiabulls Securities allows joint Demat accounts with up to 2 joint holders.\n\nRequirements for Joint Account:\n- Primary holder's PAN, Aadhaar, bank details, and signature.\n- Each joint holder's PAN and Aadhaar.\n- All holders must complete KYC verification.\n\nKey Points:\n- The primary account holder controls the account.\n- All communications go to the primary holder's email/mobile.\n- For selling shares, TPIN/eDIS authorization is required from the primary holder.\n- Joint accounts cannot be opened fully online currently — some physical documentation may be required.\n\nTo initiate: Contact our support at 022-61446300 or email helpdesk@indiabullssecurities.com.`,
  },

  // TRADING
  {
    id: 'tr-1', title: 'How to place a GTT (Good Till Trigger) order?', category: 'Trading', status: 'published',
    content: `GTT (Good Till Trigger) orders let you set buy/sell triggers that execute automatically when the market price hits your target.\n\nSteps to place a GTT order:\n1. Log in to the Indiabulls Securities app or web platform.\n2. Search for a stock and open its detail page.\n3. Click "GTT" or "Set Trigger" option.\n4. Choose the trigger type: Single trigger (one-sided) or OCO (One Cancels Other — for both buy and stop-loss).\n5. Enter the trigger price and the limit price for the order.\n6. Set the quantity and confirm.\n\nKey points:\n- GTT orders are valid for 1 year from the date of creation.\n- The order is placed only when the trigger price is hit.\n- GTT is available for equity delivery orders only (not intraday).\n- You can view and cancel active GTT orders from the Order Book.`,
  },
  {
    id: 'tr-2', title: 'How to execute a Basket Order?', category: 'Trading', status: 'published',
    content: `Basket Orders allow you to place multiple buy/sell orders simultaneously with a single click.\n\nSteps:\n1. Go to the Basket Order section in the trading platform.\n2. Click "Create Basket" and give it a name.\n3. Add stocks/F&O contracts to the basket by searching and selecting instruments.\n4. Set the quantity, order type (market/limit), and buy/sell direction for each.\n5. Review the basket and click "Execute All".\n\nUse cases:\n- Rebalancing your portfolio in one go.\n- Executing a multi-leg options strategy simultaneously.\n- Deploying a predefined watchlist of stocks.\n\nNote: Each order in the basket is placed independently — partial fills are possible if one leg hits a circuit limit or liquidity issue.`,
  },
  {
    id: 'tr-3', title: 'What is AMO (After Market Order) and how do I place one?', category: 'Trading', status: 'published',
    content: `AMO (After Market Order) lets you place buy or sell orders outside regular market hours (9:15 AM – 3:30 PM).\n\nAMO Timings:\n- You can place AMO between 4:00 PM and 8:57 AM the next trading day.\n- AMO orders are queued and sent to the exchange at market open.\n\nHow to place an AMO:\n1. Go to the stock detail page in the app.\n2. Select "AMO" as the product type.\n3. Set your price and quantity.\n4. Confirm the order.\n\nTypes of AMO:\n- Market AMO: Executes at market opening price.\n- Limit AMO: Executes only if price meets your specified limit.\n\nAMO is useful when:\n- You react to after-hours news.\n- You want to avoid placing orders in a hurried manner during market hours.`,
  },
  {
    id: 'tr-4', title: 'What is the difference between CNC, MIS, and NRML orders?', category: 'Trading', status: 'published',
    content: `Understanding Order Types:\n\nCNC (Cash and Carry):\n- For equity delivery trades.\n- Shares are delivered to your Demat account.\n- No leverage. You must have full funds.\n- Best for long-term investing.\n\nMIS (Margin Intraday Square-off):\n- For intraday equity trades.\n- Position must be squared off before 3:20 PM (auto-squared off otherwise).\n- Leverage available (varies by stock).\n- Lower margin requirement than CNC.\n\nNRML (Normal):\n- For F&O (Futures and Options) positions.\n- Can be carried overnight (subject to margin).\n- Requires SPAN + Exposure margin.\n\nWhen to use:\n- Investing → CNC\n- Intraday trading → MIS\n- F&O trading → NRML`,
  },

  // PORTFOLIO & MARGIN
  {
    id: 'pf-1', title: 'How do I view my portfolio and P&L?', category: 'Portfolio', status: 'published',
    content: `Viewing Your Portfolio:\n\n1. Log in to the Indiabulls Securities platform or app.\n2. Navigate to "Portfolio" or "Holdings" section.\n3. You will see:\n   - All your current equity holdings with quantity, average price, LTP, and P&L.\n   - Unrealized P&L (current gain/loss on open positions).\n   - Realized P&L (closed positions for the day or period).\n\nP&L Calculation:\n- Unrealized P&L = (Current Market Price - Average Buy Price) × Quantity\n- Realized P&L = Sale Price - Buy Price (for sold positions)\n\nFor tax purposes, download the Tax P&L report from Reports section.\n\nNote: P&L is updated in real-time during market hours based on live market prices.`,
  },
  {
    id: 'pf-2', title: 'What is margin and how is it calculated?', category: 'Portfolio', status: 'published',
    content: `Margin is the collateral required to take leveraged positions in the market.\n\nTypes of Margin:\n\n1. SPAN Margin: Minimum margin required by the exchange for F&O positions (calculated using SEBI's SPAN algorithm).\n\n2. Exposure Margin: Additional margin charged by the exchange on top of SPAN.\n\n3. VaR Margin: Applied on equity delivery positions to cover potential price movements.\n\n4. ELM (Extreme Loss Margin): Charged to cover extreme market movements.\n\nMargin for Intraday (MIS):\n- Equity intraday: Typically 5–20× leverage depending on the stock.\n\nMargin for F&O (NRML):\n- SPAN + Exposure as prescribed by NSE/BSE.\n\nYou can check live margin requirements in the platform before placing orders. Insufficient margin leads to position auto-squareoff.`,
  },

  // FUNDS
  {
    id: 'fn-1', title: 'How to add funds to my trading account?', category: 'Funds', status: 'published',
    content: `You can add funds to your Indiabulls Securities trading account instantly using the following methods:\n\n1. UPI (Instant): Open the app → Funds → Add Funds → Enter amount → Select UPI → Authenticate on your UPI app.\n2. Net Banking (Instant): Select your bank from the list, log in, and authorize the transfer.\n3. NEFT/RTGS: Use your unique client code-based account number provided in the app. Funds reflect within 30 minutes during banking hours.\n\nLimits:\n- UPI: Up to ₹1 lakh per transaction (₹2 lakh for UPI 2.0-enabled banks).\n- Net Banking: No upper limit (subject to bank limits).\n\nAdded funds are available for trading immediately after confirmation.`,
  },
  {
    id: 'fn-2', title: 'How long does fund withdrawal take?', category: 'Funds', status: 'published',
    content: `Fund withdrawal timelines from Indiabulls Securities:\n\n- Instant Withdrawal (up to a limit): Available 24×7. Funds credited to your bank within minutes.\n- Normal Withdrawal: Processed within the same day if requested before 3:30 PM on trading days. Credited to your bank account by next business day (T+1).\n- Weekend/Holiday requests: Processed on the next working day.\n\nSteps to withdraw:\n1. Go to Funds → Withdraw.\n2. Enter the amount (must not exceed your withdrawable balance — unsettled credits are excluded).\n3. Confirm your bank account and submit.\n\nNote: Funds from equity delivery sales are available for withdrawal after T+1 settlement. F&O proceeds are available after T+1 as well.`,
  },
  {
    id: 'fn-3', title: 'Why is my fund transfer not reflecting in the trading account?', category: 'Funds', status: 'published',
    content: `If your fund transfer is not reflecting, check the following:\n\n1. UPI Transfer:\n   - Check your UPI app for the transaction status.\n   - If successful at UPI end, funds reflect within 15–30 minutes.\n   - If UPI mandate is approved but funds not received, wait up to 1 hour.\n\n2. Net Banking Transfer:\n   - If the payment page returned an error, the transaction may have failed. Check your bank statement.\n   - Successful net banking transfers reflect within 30 minutes.\n\n3. NEFT/RTGS:\n   - NEFT batches process every 30 minutes during banking hours.\n   - RTGS: Reflects within 30 minutes if initiated before 4:30 PM.\n\nIf funds are still not showing after 2 hours:\n- Call us at 022-61446300 with your UTR/reference number.\n- Email helpdesk@indiabullssecurities.com with your bank transfer proof.`,
  },

  // IPO
  {
    id: 'ipo-1', title: 'How to apply for an IPO via UPI mandate?', category: 'IPO', status: 'published',
    content: `Applying for an IPO through Indiabulls Securities using UPI:\n\n1. Go to IPO section in the app or web platform.\n2. Select the open IPO you want to apply for.\n3. Enter the number of lots and bid price (use the cut-off price for retail investors).\n4. Enter your UPI ID (e.g., yourname@okaxis).\n5. Submit the application — you'll receive a mandate request on your UPI app.\n6. Open your UPI app (BHIM, GPay, PhonePe, etc.) and approve the mandate within the specified time.\n\nImportant:\n- Funds are blocked (not debited) until allotment.\n- If not allotted, funds are released within T+6 days.\n- Apply before the IPO close date; last-day server load may cause delays.\n- Category: Retail (up to ₹2 lakh), HNI (above ₹2 lakh).`,
  },
  {
    id: 'ipo-2', title: 'How to check IPO allotment status?', category: 'IPO', status: 'published',
    content: `You can check IPO allotment status through multiple ways:\n\n1. Via Indiabulls Securities App:\n   - Go to IPO section → Applied IPOs → Check status.\n\n2. Via Registrar Website:\n   - Visit the IPO registrar's website (e.g., KFintech, Link Intime).\n   - Enter your PAN, application number, or DP ID.\n\n3. Via BSE/NSE Website:\n   - Visit bseindia.com or nseindia.com.\n   - Navigate to the IPO allotment status section.\n\n4. Via CDSL:\n   - Log in to easi.cdslindia.com to see if shares have been credited.\n\nAllotment Timeline:\n- Allotment status is typically announced 6 business days after IPO closes.\n- Shares are credited to Demat accounts on listing day.\n- Refunds are processed within T+6 days.`,
  },
  {
    id: 'ipo-3', title: 'How to apply for an IPO through Indiabulls Securities (ASBA)?', category: 'IPO', status: 'published',
    content: `You can apply for IPOs through Indiabulls Securities using ASBA (Application Supported by Blocked Amount):\n\nMethod 1 — via App/Web:\n1. Open the IPO section and select the live IPO.\n2. Enter bid details (lots, price, UPI ID).\n3. Approve the UPI mandate — funds are blocked until allotment.\n\nMethod 2 — via Net Banking ASBA:\n1. Log in to your bank's net banking portal.\n2. Go to the IPO/ASBA section.\n3. Enter your DP ID, client ID, and bid details.\n4. Funds are blocked directly from your bank account.\n\nAfter allotment:\n- If allotted: Shares are credited to your Demat account and funds are debited on listing day.\n- If not allotted: Blocked funds are released within 6 working days.\n\nTip: Use the cut-off price option for retail investors to maximise allotment chances.`,
  },

  // F&O
  {
    id: 'fo-1', title: 'What is the F&O Ban Period and why does it happen?', category: 'F&O', status: 'published',
    content: `The F&O Ban Period (also called the trading ban or MWPL ban) is imposed on a stock when the total open interest (OI) in its futures and options contracts exceeds 95% of the Market-Wide Position Limit (MWPL).\n\nDuring the ban period:\n- No new F&O positions can be opened in that stock.\n- You can only square off (close) existing positions.\n- Violation attracts a penalty of ₹1 lakh or 1% of the value of the open position, whichever is higher.\n\nThe ban is lifted when OI drops below 80% of MWPL.\n\nHow to check ban list:\n- NSE publishes the F&O ban list daily on its website.\n- Your trading platform will also show a warning when you try to trade a banned stock.`,
  },
  {
    id: 'fo-2', title: 'How do I trade Options on Indiabulls Securities?', category: 'F&O', status: 'published',
    content: `Trading Options on Indiabulls Securities:\n\nPrerequisites:\n- F&O trading must be enabled in your account. Apply via Account Settings → Segments.\n- Ensure you have sufficient NRML margin in your account.\n\nPlacing an Options Order:\n1. Go to the Options Chain for the index/stock you want to trade.\n2. Select the expiry date and strike price.\n3. Choose CE (Call) or PE (Put).\n4. Place Buy or Sell order with NRML product type.\n5. Set quantity in lots (lot size varies per contract).\n\nKey Concepts:\n- Buyer of options: Pays premium, limited loss (premium paid), unlimited profit potential.\n- Seller of options: Receives premium, unlimited risk, requires higher margin.\n- Premium: Price of the option contract.\n- Strike Price: Pre-agreed price for exercising the option.\n- Expiry: Options expire on the last Thursday of the month (or weekly for Nifty/BankNifty).`,
  },
  {
    id: 'fo-3', title: 'What are the margin requirements for F&O trading?', category: 'F&O', status: 'published',
    content: `F&O Margin Requirements (as per SEBI regulations):\n\nFor Futures (Buying or Selling):\n- SPAN Margin: Set by exchanges (NSE/BSE). Covers worst-case 1-day loss.\n- Exposure Margin: Additional 3-5% of contract value charged by exchange.\n- Total Margin Required = SPAN + Exposure Margin.\n\nFor Options:\n- Buying Options: Full premium amount required (no additional margin).\n- Selling Options: SPAN + Exposure margin required (similar to futures).\n\nIntraday (MIS) F&O:\n- Available on select contracts.\n- Lower margin with auto-squareoff at 3:25 PM.\n\nChecking Live Margins:\n- Use the Margin Calculator in the platform before placing trades.\n- Visit NSE website for updated SPAN margin files.\n\nNote: SEBI mandates peak margin reporting 4 times daily. Shortfall may attract a penalty.`,
  },

  // PLEDGING
  {
    id: 'pl-1', title: 'How to pledge shares for margin in Indiabulls Securities?', category: 'Pledging', status: 'published',
    content: `Pledging shares allows you to use your equity holdings as collateral to get additional margin for trading.\n\nHow to Pledge:\n1. Go to Portfolio → Holdings → Select shares to pledge.\n2. Click "Pledge for Margin".\n3. Enter quantity and confirm.\n4. You will receive an OTP on your registered mobile/email (CDSL authorization).\n5. Approve the pledge via CDSL Easiest or OTP confirmation.\n\nCollateral Margin:\n- After pledging, you receive 50–80% of the share value as collateral margin (after haircut).\n- Haircut varies by stock — blue-chip stocks have lower haircuts.\n- Collateral margin can be used for F&O trading (not for equity delivery).\n\nUnpledging:\n- Go to Portfolio → Pledged Holdings → Select → Unpledge.\n- Shares are released within 1–2 working days after unpledge request.\n\nNote: Pledged shares remain in your Demat account but are marked as pledged and cannot be sold until unpledged.`,
  },
  {
    id: 'pl-2', title: 'What is a haircut in pledging and how is it calculated?', category: 'Pledging', status: 'published',
    content: `Haircut is the percentage reduction applied to the market value of pledged securities when calculating the collateral margin.\n\nExample:\n- You pledge shares worth ₹1,00,000.\n- Haircut = 20%\n- Collateral Margin Received = ₹1,00,000 × (1 - 0.20) = ₹80,000\n\nHaircut Determination:\n- Set by exchanges (NSE/BSE/SEBI) based on stock volatility, liquidity, and risk profile.\n- Blue-chip / large-cap stocks: 10–20% haircut.\n- Mid-cap stocks: 20–35% haircut.\n- Small-cap / illiquid stocks: 40–50%+ haircut.\n- Some stocks may not be eligible for pledging.\n\nChecking Haircut:\n- The platform shows the applicable haircut and eligible margin before you confirm the pledge.\n\nNote: Cash equivalent margin (from selling pledged shares) carries no haircut.`,
  },

  // ACCOUNT
  {
    id: 'acc-1', title: 'How to reset my Indiabulls Securities password?', category: 'Account', status: 'published',
    content: `Resetting Your Password:\n\nMethod 1 — Via Login Page:\n1. Go to the Indiabulls Securities login page.\n2. Click "Forgot Password".\n3. Enter your Client ID or registered email.\n4. You'll receive an OTP on your registered mobile number.\n5. Enter the OTP and set a new password.\n\nMethod 2 — Via App:\n1. Open the app and tap "Forgot Password" on the login screen.\n2. Follow the same OTP-based reset process.\n\nPassword Requirements:\n- Minimum 8 characters.\n- Must include uppercase, lowercase, a number, and a special character.\n- Cannot reuse last 5 passwords.\n\nIf you don't receive the OTP:\n- Check if your registered mobile number is active.\n- Call support at 022-61446300 to update your mobile number.`,
  },
  {
    id: 'acc-2', title: 'How do I update my bank account details?', category: 'Account', status: 'published',
    content: `Updating Bank Account Details:\n\nNote: Bank account changes require physical verification for security reasons.\n\nProcess:\n1. Submit a written request to helpdesk@indiabullssecurities.com with subject "Bank Account Change Request".\n2. Attach:\n   - Latest bank statement or cancelled cheque (new bank account)\n   - Self-attested PAN copy\n   - Client ID\n3. Our team will verify and process within 3–5 business days.\n\nAlternatively:\n- Visit the nearest Indiabulls Securities office with original documents.\n\nImportant:\n- Until the change is processed, withdrawals will go to the old bank account.\n- Fund additions can still be made from the new account.\n- You cannot change bank accounts online to prevent fraud. This is a security measure.`,
  },
  {
    id: 'acc-3', title: 'How to enable two-factor authentication (2FA)?', category: 'Account', status: 'published',
    content: `Two-Factor Authentication (2FA) adds an extra layer of security to your account.\n\nEnabling 2FA:\n1. Log in to the web platform.\n2. Go to Profile → Security Settings.\n3. Click "Enable 2FA".\n4. Choose your preferred method: OTP via SMS or Authenticator App (Google Authenticator/Authy).\n5. Scan the QR code (for authenticator app) or confirm your mobile number (for SMS OTP).\n6. Enter the 6-digit code to verify and activate.\n\nHow 2FA Works:\n- Every time you log in, after entering your password, you'll be asked for a 6-digit OTP.\n- The OTP refreshes every 30 seconds.\n\nIf you lose access to your 2FA device:\n- Call 022-61446300 immediately to temporarily disable 2FA after identity verification.`,
  },

  // REPORTS
  {
    id: 'rp-1', title: 'How to download my Tax P&L statement for ITR filing?', category: 'Reports', status: 'published',
    content: `Your Tax P&L (Profit & Loss) report is essential for filing your Income Tax Return (ITR) as it details realized gains/losses from trading.\n\nSteps to download:\n1. Log in to the Indiabulls Securities web platform.\n2. Go to Reports → Tax P&L or Tax Statement.\n3. Select the financial year (e.g., April 2024 – March 2025).\n4. Click Download — the report is available in PDF or Excel format.\n\nThe report includes:\n- Short-term capital gains (STCG) — held less than 1 year for equity.\n- Long-term capital gains (LTCG) — held more than 1 year.\n- Speculative income (intraday equity).\n- F&O business income (treated as non-speculative business income).\n\nShare the report with your CA or use it directly in ITR-2/ITR-3 as applicable.`,
  },
  {
    id: 'rp-2', title: 'How to download my contract notes?', category: 'Reports', status: 'published',
    content: `Contract Notes are legal records of every trade you execute. SEBI mandates that brokers send contract notes within 24 hours of trade execution.\n\nHow to Access Contract Notes:\n1. Log in to Indiabulls Securities web platform.\n2. Go to Reports → Contract Notes.\n3. Select the date range.\n4. Download as PDF.\n\nYou also receive contract notes via email on your registered email ID automatically after each trading day.\n\nWhat's in a Contract Note:\n- Trade details (stock, quantity, price, time)\n- Brokerage charges\n- Taxes (STT, GST, Exchange charges, Stamp Duty)\n- Net settlement amount\n\nContract notes are typically available within 24 hours of trade execution.\nFor older contract notes (beyond 3 months), contact helpdesk@indiabullssecurities.com.`,
  },

  // CONTACT & ESCALATION
  {
    id: 'cf-1', title: 'How do I contact Indiabulls Securities support?', category: 'Contact & Escalation', status: 'published',
    content: `Indiabulls Securities Support Channels:\n\n1. Phone Support:\n   - Number: 022-61446300\n   - Hours: Monday – Saturday, 8 AM – 8 PM\n   - For urgent trading issues during market hours.\n\n2. Email Support:\n   - Email: helpdesk@indiabullssecurities.com\n   - Response: Within 4 hours on business days.\n   - Best for: Detailed queries, document submissions, bank change requests.\n\n3. Online Ticket System:\n   - Submit a support ticket via this portal (Contact Us page).\n   - Track your ticket status on My Tickets page.\n\n4. Registered Office:\n   - Plot no. 108, 5th Floor, IT Park, Udyog Vihar, Phase - I, Gurugram – 122016, Haryana.\n\nFor trading-related urgent issues during market hours, phone support is recommended.`,
  },
  {
    id: 'cf-2', title: 'How do I escalate an unresolved complaint?', category: 'Contact & Escalation', status: 'published',
    content: `Grievance Escalation Process:\n\nLevel 1 — Support Team:\n- Email: helpdesk@indiabullssecurities.com\n- Call: 022-61446300\n- Resolution within 2 business days.\n\nLevel 2 — Compliance/Grievance Officer:\n- If Level 1 doesn't resolve within 2 business days:\n- Email: compliance@indiabullssecurities.com\n- Resolution within 5 business days.\n\nLevel 3 — SEBI SCORES:\n- If unsatisfied with broker's resolution:\n- File a complaint at scores.sebi.gov.in\n- SEBI takes it up with the broker.\n\nLevel 4 — Exchange Arbitration:\n- For disputes related to trading:\n- Contact NSE/BSE arbitration cell.\n\nPlease ensure you have your Client ID, complaint reference number, and all communication history when escalating.`,
  },

  // MTF (Margin Trading Facility)
  {
    id: 'mtf-1', title: 'What is MTF (Margin Trading Facility) and how does it work?', category: 'MTF', status: 'published',
    content: `MTF (Margin Trading Facility) allows you to buy eligible shares by paying only a portion of the total value, with the rest funded by the broker.\n\nHow it Works:\n- You pay an initial margin (typically 20–50% of the stock value).\n- Indiabulls Securities funds the remaining amount.\n- You pay interest on the funded amount (daily interest rate applies).\n- You can hold the MTF position as long as you maintain the required margin.\n\nEligible Stocks:\n- SEBI-approved securities listed in Group 1 of the exchange.\n- Typically large-cap and high-liquidity stocks.\n\nInterest Rate:\n- MTF interest is charged daily on the outstanding funded amount.\n- Competitive rates — check the platform for current rates.\n\nRisk:\n- If the stock price falls and your margin drops below the minimum required, you'll receive a margin call.\n- Failure to top up may result in auto-liquidation of your MTF position.\n\nTo enable MTF:\n- Go to Account Settings → Segments → Enable MTF.`,
  },
  {
    id: 'mtf-2', title: 'What are the risks and interest charges for MTF?', category: 'MTF', status: 'published',
    content: `MTF Risks and Charges:\n\nInterest Charges:\n- Interest is charged daily on the funded amount.\n- Annual rate typically ranges between 12–18% p.a. (subject to change).\n- Check the current rate on the Indiabulls Securities platform under MTF section.\n\nExample:\n- You buy stocks worth ₹1,00,000 under MTF.\n- You pay ₹30,000 (30% margin). Broker funds ₹70,000.\n- Daily interest at 15% p.a. = ₹70,000 × 15% / 365 = ₹28.77 per day.\n\nRisks:\n- Market Risk: If the stock price falls, you bear the full loss on the total position value.\n- Margin Call: If margin drops below minimum threshold, you must add funds or the position may be closed.\n- Forced Liquidation: Non-maintenance of margin leads to broker selling your securities.\n\nBest Practices:\n- Keep extra margin buffer above minimum requirement.\n- Monitor MTF positions daily.\n- Understand that leverage amplifies both gains and losses.`,
  },

  // TENDER OFFERS
  {
    id: 'to-1', title: 'How to participate in a Buyback offer through Indiabulls Securities?', category: 'Tender Offers', status: 'published',
    content: `Participating in a Buyback (Tender Offer):\n\nTypes of Buybacks:\n1. Tender Offer Buyback: Company buys shares directly from shareholders at a fixed price via stock exchange.\n2. Open Market Buyback: Company buys shares from the secondary market (no action needed from retail investors).\n\nFor Tender Offer Buyback:\n1. Check if you hold the eligible record-date shares in your Demat.\n2. Log in to Indiabulls Securities platform.\n3. Go to Corporate Actions → Buyback/Tender Offer.\n4. Select the company's buyback offer.\n5. Enter the quantity of shares to tender.\n6. TPIN/eDIS authorization required to debit shares.\n7. Confirm the tender.\n\nKey Points:\n- Buyback price is usually at a premium to market price.\n- Not all shares tendered are accepted — acceptance ratio applies.\n- Unaccepted shares are returned to your Demat account.`,
  },
  {
    id: 'to-2', title: 'How to participate in an OFS (Offer for Sale)?', category: 'Tender Offers', status: 'published',
    content: `OFS (Offer for Sale) allows promoters or major shareholders to sell their stake to retail and institutional investors through the stock exchange.\n\nHow to Participate in OFS:\n1. Log in to Indiabulls Securities platform during the OFS window (typically 1–2 days).\n2. Go to IPO/OFS section.\n3. Select the OFS you want to participate in.\n4. Enter your bid price (at or above the floor price) and quantity.\n5. Funds are blocked via UPI mandate.\n\nOFS Types:\n- Regular category: For retail investors with order value up to ₹2 lakh. Discount on floor price available (if announced).\n- Non-retail category: Institutional and HNI investors.\n\nAllotment:\n- Done on a price-priority basis — higher bid price gets priority.\n- Retail investors get a discount on the cut-off price (if announced by seller).\n- Settlement is T+1.`,
  },

  // KYC
  {
    id: 'kyc-1', title: 'What is the KYC process for opening a trading account?', category: 'KYC Process', status: 'published',
    content: `KYC (Know Your Customer) is a mandatory regulatory process for verifying your identity before opening a trading account.\n\nKYC Documents Required:\n1. Identity Proof: PAN Card (mandatory) + Aadhaar Card\n2. Address Proof: Aadhaar / Passport / Voter ID / Utility Bill\n3. Bank Proof: Cancelled cheque / Bank statement (last 3 months)\n4. Income Proof: Latest ITR / Salary Slip / Bank statement (required for F&O/Commodity activation)\n\nOnline e-KYC Process:\n1. Enter PAN and Aadhaar details.\n2. Aadhaar OTP verification for identity authentication.\n3. Live selfie capture for face match.\n4. Upload additional documents if required.\n5. Digital signature via Aadhaar OTP e-Sign.\n\nOffline KYC:\n- Submit physical copies of all documents at the nearest branch.\n- In-person verification (IPV) via video call may be required.\n\nKYC is valid for life unless your personal details change.`,
  },
  {
    id: 'kyc-2', title: 'How do I update my KYC details (address, mobile, email)?', category: 'KYC Process', status: 'published',
    content: `Updating KYC Details:\n\nUpdating Mobile Number:\n1. Submit a request to helpdesk@indiabullssecurities.com.\n2. Provide: Client ID, old mobile, new mobile, and self-attested PAN copy.\n3. You will receive a verification call on the new number.\n4. Update processed within 2–3 business days.\n\nUpdating Email ID:\n- Same process as mobile update. The verification link/OTP is sent to both old and new email.\n\nUpdating Address:\n1. Submit updated address proof (Aadhaar / Utility Bill / Passport).\n2. Self-attest the document with your signature and client ID.\n3. Email to helpdesk@indiabullssecurities.com.\n4. Address updated within 3–5 business days.\n\nUpdating through KYC Portal:\n- If your Aadhaar is updated, you can update KYC via the CVL/CAMS/Karvy KYC portal directly.\n\nNote: Until updates are processed, OTPs and communications continue to the old contact details.`,
  },

  // CHARGES & BROKERAGE
  {
    id: 'ch-1', title: 'What are Indiabulls Securities brokerage charges and pricing plans?', category: 'Charges & Brokerage', status: 'published',
    content: `Indiabulls Securities offers the following brokerage plans:\n\nFlat Fee Plan:\n- Equity Delivery: ₹0 (free)\n- Equity Intraday: ₹20 per executed order or 0.05%, whichever is lower\n- F&O (Futures): ₹20 per executed order\n- F&O (Options): ₹20 per executed order\n- Currency: ₹20 per executed order\n\nOther applicable charges (regulatory):\n- STT: 0.1% on delivery; 0.025% on intraday sell side\n- Exchange Transaction Charges: 0.00335% (NSE equity)\n- GST: 18% on brokerage + transaction charges\n- SEBI Turnover Fee: ₹10 per crore\n- Stamp Duty: As per state (0.015% on delivery buy, 0.003% on intraday/F&O)\n- DP Charges: ₹13.5 + GST per scrip per day on delivery sell\n\nUse the brokerage calculator in the app to estimate charges before trading.`,
  },
  {
    id: 'ch-2', title: 'What are the DP (Depository Participant) charges?', category: 'Charges & Brokerage', status: 'published',
    content: `DP (Depository Participant) Charges are levied when you sell equity shares from your Demat account.\n\nDP Charges Structure:\n- ₹13.5 + GST (18%) per scrip per day on each delivery sell transaction.\n- This is a flat charge — applies regardless of the quantity sold.\n\nExample:\n- You sell 100 shares of Company A and 50 shares of Company B in a single day.\n- DP Charges = 2 scrips × ₹13.5 = ₹27 + GST = ₹31.86\n\nWhen are DP Charges NOT applicable:\n- Intraday trades (buy and sell on the same day)\n- F&O trades\n- When buying shares (DP charges only on selling from Demat)\n\nAnnual Maintenance Charge (AMC):\n- ₹300–400 per year for Demat account maintenance (charged annually).\n- First year may be free as a welcome offer.\n\nAll charges are visible in your contract notes and ledger statement.`,
  },
  {
    id: 'ch-3', title: 'How to view my ledger and account statement?', category: 'Charges & Brokerage', status: 'published',
    content: `Your ledger shows all financial transactions — credits, debits, charges, and settlements.\n\nHow to Access Ledger:\n1. Log in to Indiabulls Securities web platform.\n2. Go to Reports → Ledger / Account Statement.\n3. Select the date range (default: last 30 days).\n4. Download as PDF or Excel.\n\nLedger Entries Include:\n- Fund additions and withdrawals\n- Trade settlements (credit/debit for buy/sell)\n- Brokerage and charges deducted\n- Dividend credits\n- DP charges\n- Interest charges (for MTF)\n\nInterpreting Ledger Balance:\n- Positive balance (Cr): Funds available for trading/withdrawal.\n- Negative balance (Dr): Shortfall — you owe funds to the broker (rare, usually due to MTF interest or charges).\n\nFor discrepancies, email helpdesk@indiabullssecurities.com with your ledger screenshot and query.`,
  },

  // COMPLIANCE & SAFETY
  {
    id: 'co-1', title: 'How to generate and use CDSL TPIN for selling shares?', category: 'Compliance & Safety', status: 'published',
    content: `CDSL TPIN (Transaction PIN) is required to authorize the sale of shares from your Demat account as per SEBI mandate.\n\nGenerating your TPIN:\n1. Go to cdsl.com or use the CDSL Easiest portal.\n2. Register with your BO ID (Demat account number) and PAN.\n3. Set a 6-digit TPIN via OTP verification.\n\nUsing TPIN while selling:\n1. Place a sell order in your trading platform.\n2. You will receive an OTP on your registered mobile/email.\n3. Enter the TPIN + OTP to authorize the debit of shares.\n\nAlternatively, use the eDIS (electronic Delivery Instruction Slip) method:\n- Pre-authorize shares for sale using Aadhaar OTP via CDSL.\n- Valid for the current trading day only.\n\nNote: TPIN/eDIS is mandatory for all sell transactions. Failure to authorize will result in a short delivery penalty.`,
  },
  {
    id: 'co-2', title: 'What is ASM/GSM and how does it affect my trading?', category: 'Compliance & Safety', status: 'published',
    content: `ASM (Additional Surveillance Measure) and GSM (Graded Surveillance Measure) are frameworks by SEBI/Exchanges to protect investors from suspicious price movements.\n\nASM (Additional Surveillance Measure):\n- Applied to stocks showing unusual price movements, high PE ratio, or low liquidity.\n- Stocks under ASM require 100% upfront margin for buy orders.\n- Intraday trading may be restricted.\n- Carry-forward positions limited.\n\nGSM (Graded Surveillance Measure):\n- Applied to fundamentally weak companies.\n- 6 stages (GSM 1–6) with increasing restrictions:\n  - GSM 1–3: Higher margins, trade-to-trade settlement.\n  - GSM 4–6: Only squaring off allowed (no fresh buying).\n\nHow to Check:\n- NSE and BSE publish the ASM/GSM list daily on their websites.\n- The trading platform will display a warning badge on restricted stocks.\n\nIf your stock is under ASM/GSM, you may not be able to place normal orders.`,
  },
  {
    id: 'co-3', title: 'How does Indiabulls Securities protect my account from fraud?', category: 'Compliance & Safety', status: 'published',
    content: `Indiabulls Securities employs multiple layers of security to protect your account:\n\n1. Two-Factor Authentication (2FA):\n   - OTP required at every login.\n   - Configurable via SMS or Authenticator App.\n\n2. TPIN for Selling Shares:\n   - CDSL TPIN authorization required for every sell transaction.\n   - Prevents unauthorized sale of your holdings.\n\n3. Activity Alerts:\n   - SMS and email alerts for every login, trade, fund transfer, and password change.\n\n4. Secure Communication:\n   - 256-bit SSL encryption on all data transmission.\n   - HTTPS enforced across all platforms.\n\n5. IP-Based Login Monitoring:\n   - Unusual login attempts from new devices trigger alerts.\n\nDO NOT:\n- Share your Client ID, password, or OTP with anyone — including those claiming to be Indiabulls staff.\n- Click on suspicious links claiming to be from Indiabulls.\n- Give remote access to your device for "investment advice".\n\nReport suspicious activity immediately at 022-61446300.`,
  },

  // MUTUAL FUNDS
  {
    id: 'mf-1', title: 'How to set up a SIP in Mutual Funds?', category: 'Mutual Funds', status: 'published',
    content: `Setting up a Systematic Investment Plan (SIP) through Indiabulls Securities:\n\n1. Go to Mutual Funds section in the app.\n2. Search for the fund you want to invest in (e.g., Nifty 50 Index Fund, ELSS fund).\n3. Click "Invest" → Select "SIP".\n4. Enter the monthly SIP amount (minimum ₹500 for most funds).\n5. Choose the SIP date (1st, 5th, 10th, 15th, 20th, or 25th of the month).\n6. Select your bank account and payment method (UPI / Net Banking).\n7. Confirm and activate the SIP.\n\nKey points:\n- SIPs are auto-debited on the chosen date every month.\n- You can pause or cancel a SIP anytime from the Mutual Funds dashboard.\n- ELSS SIPs qualify for tax deduction under Section 80C (up to ₹1.5 lakh/year).\n- Growth and IDCW (dividend) plan options available.`,
  },
  {
    id: 'mf-2', title: 'How to redeem mutual fund units?', category: 'Mutual Funds', status: 'published',
    content: `Redeeming Mutual Fund Units:\n\n1. Go to Mutual Funds → My Investments.\n2. Select the fund you want to redeem.\n3. Click "Redeem".\n4. Choose redemption type:\n   - Full Redemption: Redeem all units.\n   - Partial Redemption: Enter specific amount or units.\n5. Confirm bank account for credit.\n6. Submit redemption request.\n\nRedemption Timeline:\n- Liquid / Overnight Funds: T+1 business day.\n- Debt Funds: T+2 business days.\n- Equity Funds: T+3 business days.\n- ELSS Funds: Only after 3-year lock-in period.\n\nTax on Redemption:\n- Equity funds held < 1 year: 15% STCG tax.\n- Equity funds held > 1 year: 10% LTCG (gains above ₹1 lakh per year).\n- Debt funds: As per income tax slab.\n\nNAV Applied: Based on time of submission and fund category cutoff time (usually 3:00 PM).`,
  },
  {
    id: 'mf-3', title: 'What is the difference between Direct and Regular mutual fund plans?', category: 'Mutual Funds', status: 'published',
    content: `Understanding Direct vs Regular Plans:\n\nDirect Plan:\n- You invest directly with the fund house (AMC).\n- No distributor/agent involved.\n- Lower expense ratio (typically 0.5–1% less than Regular plan).\n- Higher NAV = Higher returns over long term.\n- Best for: Informed investors who can research and select funds themselves.\n\nRegular Plan:\n- Invested through a distributor/broker.\n- Higher expense ratio (commission paid to distributor included).\n- Lower NAV compared to Direct plan.\n- Comes with advisory and handholding.\n- Best for: Investors who want guidance.\n\nImpact Over Time:\n- On a ₹10,000/month SIP over 20 years at 12% return:\n  - Regular plan (13% net): ~₹1.06 crore\n  - Direct plan (13.5% net): ~₹1.13 crore\n  - Difference: ~₹7 lakh+ just from expense ratio savings.\n\nOn Indiabulls Securities, you can invest in both Direct and Regular plans.`,
  },

  // NRI / HUF ACCOUNTS
  {
    id: 'nri-1', title: 'How can NRIs open a trading account with Indiabulls Securities?', category: 'NRI / HUF Accounts', status: 'published',
    content: `NRI (Non-Resident Indian) Trading Account Opening:\n\nDocuments Required:\n- PAN Card\n- Passport copy (self-attested)\n- Visa / OCI / PIO card copy\n- Foreign address proof (utility bill / bank statement)\n- NRE / NRO bank account details (cancelled cheque)\n- FEMA declaration\n- PIS (Portfolio Investment Scheme) permission letter from bank (for NRE account)\n\nTypes of NRI Accounts:\n1. NRE (Non-Resident External) Account:\n   - Funds remitted from abroad.\n   - Repatriable (can send money back abroad).\n   - Interest income tax-free in India.\n\n2. NRO (Non-Resident Ordinary) Account:\n   - Income earned in India (rent, dividends).\n   - Repatriation limited to USD 1 million per year.\n   - Interest income taxable in India.\n\nPIS (Portfolio Investment Scheme):\n- Mandatory for NRIs to invest in Indian equities.\n- Obtained from an authorized bank (e.g., HDFC, SBI, ICICI).\n\nContact our NRI desk at helpdesk@indiabullssecurities.com for assistance.`,
  },
  {
    id: 'nri-2', title: 'What are the investment restrictions for NRIs in India?', category: 'NRI / HUF Accounts', status: 'published',
    content: `NRI Investment Restrictions Under FEMA and SEBI:\n\nAllowed Investments:\n- Equity shares (via PIS-linked NRE/NRO account)\n- Mutual Funds (direct investment without PIS)\n- Government Securities\n- Fixed Deposits\n- IPOs\n\nRestricted Sectors:\n- NRIs cannot invest in companies in certain strategic sectors (e.g., atomic energy, defence).\n- Investment in print media is restricted.\n\nTrading Restrictions:\n- NRIs cannot do intraday trading. All trades must result in delivery.\n- No short-selling allowed for NRIs.\n- F&O trading is permitted under certain conditions.\n\nRepatriation Limits:\n- NRE: Fully repatriable without limits.\n- NRO: USD 1 million per financial year (subject to tax clearance).\n\nTaxation:\n- Dividends: Taxed at source (TDS applies).\n- Capital Gains: STCG at 15% for equity; LTCG at 10% above ₹1 lakh.\n- Double Taxation Avoidance Agreement (DTAA) may reduce tax liability for residents of countries with treaties.`,
  },
  {
    id: 'nri-3', title: 'How can a HUF (Hindu Undivided Family) open a trading account?', category: 'NRI / HUF Accounts', status: 'published',
    content: `HUF (Hindu Undivided Family) Trading Account:\n\nA HUF can be formed by a Hindu, Buddhist, Jain, or Sikh family. It has its own PAN and can invest independently.\n\nDocuments Required:\n- HUF PAN Card\n- Karta's (head of family) PAN and Aadhaar\n- HUF Declaration / Deed\n- Bank account in HUF's name (with HUF PAN)\n- List of all coparceners (family members)\n- HUF's address proof\n\nProcess:\n1. Submit the account opening application as HUF.\n2. Provide all HUF documents.\n3. Complete KYC for the Karta (the managing member).\n4. Account will be opened in the HUF's name.\n\nTax Benefits of HUF:\n- HUF has a separate tax exemption limit (₹2.5 lakh per year).\n- Can reduce overall family tax burden by distributing income.\n\nNote: All investments are made by the Karta on behalf of the HUF. Karta's TPIN is used for selling shares.`,
  },
];

function FAQContent() {
  const searchParams = useSearchParams();
  const rawCat = searchParams.get('cat') || 'all';
  // Whitelist the category param against known valid values
  const catParam = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState(catParam);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const validated = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'all';
    setSelectedCat(validated);
  }, [rawCat]);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      if (!API_BASE) throw new Error('No API configured');
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      const published = items.filter((a) => !a.status || a.status === 'published' || a.status === 'active' || a.status === 'approved');
      // Merge with fallback: API articles first, then any fallback articles not covered by API
      const apiIds = new Set(published.map(a => a.id));
      const merged = [...published, ...FALLBACK_ARTICLES.filter(a => !apiIds.has(a.id))];
      setArticles(merged);
    } catch {
      // Always fall back to complete offline article set
      setArticles(FALLBACK_ARTICLES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Category key → display label mapping for flexible matching
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
                onChange={(e) => setSearch(e.target.value)}
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
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    }>
      <FAQContent />
    </Suspense>
  );
}
