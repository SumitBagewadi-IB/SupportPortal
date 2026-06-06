/**
 * ib-faq-api  —  Node.js 22.x  GCP Cloud Functions Gen 2 (ES Module)
 *
 * Routes:
 *   GET    /faq                    public
 *   POST   /faq                    manager JWT | master secret
 *   PUT    /faq/{id}               manager JWT | master secret
 *   DELETE /faq/{id}               manager JWT | master secret
 *
 *   GET    /tickets                manager JWT | master secret
 *   POST   /tickets                public (captures IP + UA + sessionId)
 *   PUT    /tickets/{id}           manager JWT | master secret
 *
 *   GET    /audit-log              manager JWT (own entries) | master secret (all)
 *
 *   POST   /auth/login             public  → returns manager JWT
 *   POST   /auth/masterlogin       public  → validates master password server-side, returns master session token
 *   POST   /auth/logout            manager JWT | master session token → writes audit entry
 *
 *   POST   /analytics              public  → writes to analytics collection
 *   GET    /analytics/summary      master session token → aggregated stats
 *
 *   GET    /managers               master session token
 *   POST   /managers               master session token
 *   PUT    /managers/{id}          master session token
 *   DELETE /managers/{id}          master session token
 *
 *   GET    /categories             public
 *   POST   /categories             manager JWT | master secret
 *   PUT    /categories/{id}        manager JWT | master secret
 *   DELETE /categories/{id}        manager JWT | master secret
 *
 * Env vars:
 *   ADMIN_SECRET          shared secret checked against X-Admin-Secret for manager-level access
 *   MASTER_ADMIN_SECRET   master password — NEVER sent to the browser; validated server-side only
 *   JWT_SECRET            HMAC-SHA256 signing key for manager tokens AND master session tokens
 *   GOOGLE_CLOUD_PROJECT  GCP project ID (used by Firestore client)
 *   ALLOWED_ORIGINS       comma-separated list of allowed CORS origins
 *
 * Firestore collection names (mirror DynamoDB table names):
 *   articles      (was ibulls-faq-articles)
 *   tickets       (was ib-tickets)
 *   audit-log     (was ib-audit-log)
 *   analytics     (was ib-analytics)
 *   managers      (was ib-managers)
 *   categories    (was ib-faq-categories)
 */

import functions from '@google-cloud/functions-framework';
import { Firestore } from '@google-cloud/firestore';
import { createHmac, randomUUID } from 'crypto';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ─── Config ────────────────────────────────────────────────────────────────

const FAQ_COL       = process.env.FAQ_COLLECTION       || 'articles';
const TICKETS_COL   = process.env.TICKETS_COLLECTION   || 'tickets';
const AUDIT_COL     = process.env.AUDIT_COLLECTION     || 'audit-log';
const ANALYTICS_COL = process.env.ANALYTICS_COLLECTION || 'analytics';
const MANAGERS_COL  = process.env.MANAGERS_COLLECTION  || 'managers';
const CATEGORIES_COL= process.env.CATEGORIES_COLLECTION|| 'categories';

const ADMIN_SECRET        = process.env.ADMIN_SECRET        || '';
const MASTER_ADMIN_SECRET = process.env.MASTER_ADMIN_SECRET || '';
const JWT_SECRET          = process.env.JWT_SECRET          || (() => { throw new Error('JWT_SECRET env var is required'); })();

// Fail-fast: warn loudly if privileged secrets are missing
if (!ADMIN_SECRET)        console.error('[STARTUP] WARNING: ADMIN_SECRET is not set — manager header auth is disabled');
if (!MASTER_ADMIN_SECRET) console.error('[STARTUP] WARNING: MASTER_ADMIN_SECRET is not set — /auth/masterlogin will return 503');

const TOKEN_TTL_SECS        = 7200;  // 2 hours — manager JWT
const MASTER_TOKEN_TTL_SECS = 28800; // 8 hours — master session token

const db = new Firestore();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const VALID_FAQ_STATUSES    = ['published', 'draft'];
const VALID_TICKET_STATUSES = ['open', 'in_progress', 'solved', 'resolved'];
const ALLOWED_TICKET_CATEGORIES = [
  'Getting Started', 'Account Opening', 'Trading', 'Portfolio & Margin',
  'Funds', 'Charges & Brokerage', 'Compliance & Safety', 'Mutual Funds',
  'IPO', 'F&O', 'Pledging', 'MTF', 'Tender Offers', 'Contact & Help',
  'Advanced', 'Account', 'Reports', 'NRI/HUF Accounts', 'Other',
];

// ─── CORS ──────────────────────────────────────────────────────────────────

function buildCorsHeaders(origin) {
  // Auth is header-based (X-Admin-Secret, Bearer tokens) — not cookie-based.
  // We never send credentials:true from the browser, so we can safely reflect
  // the requesting origin (or * when no origin header) without needing
  // Access-Control-Allow-Credentials.
  const allowedOrigin = ALLOWED_ORIGINS.length > 0
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : '*')
    : (origin || '*');
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Secret,X-Master-Token,Authorization',
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sourceIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

function userAgent(req) {
  return (req.headers['user-agent'] || '').slice(0, 300);
}

function parseBrowser(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) && /Version\//.test(ua) ? 'Safari' :
    /MSIE|Trident/.test(ua) ? 'IE' : 'Other';
  const os =
    /Windows NT/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua) ? 'macOS' :
    /iPhone/.test(ua) ? 'iOS' :
    /iPad/.test(ua) ? 'iPadOS' :
    /Android/.test(ua) ? 'Android' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  const device =
    /iPhone|Android.*Mobile|Windows Phone/.test(ua) ? 'Mobile' :
    /iPad|Android(?!.*Mobile)/.test(ua) ? 'Tablet' : 'Desktop';
  return { browser, os, device };
}

// ─── JWT (library-free HMAC-SHA256) ────────────────────────────────────────

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function makeJWT(payload) {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECS }));
  const sig     = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest());
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Password hashing (scrypt) ──────────────────────────────────────────────

async function hashPassword(password) {
  const salt = randomUUID().replace(/-/g, '');
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, hash) {
  try {
    const [salt, stored] = hash.split(':');
    const derived = await scryptAsync(password, salt, 64);
    const storedBuf = Buffer.from(stored, 'hex');
    return timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

// ─── Auth extraction ────────────────────────────────────────────────────────

function makeMasterToken() {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ role: 'masteradmin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + MASTER_TOKEN_TTL_SECS }));
  const sig     = b64url(createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function verifyMasterToken(token) {
  const payload = verifyJWT(token);
  return payload?.role === 'masteradmin' ? payload : null;
}

function extractAuth(req) {
  const authHdr  = req.headers['authorization'] || '';
  const xMaster  = req.headers['x-master-token'] || req.query?.['_mt'] || '';
  const xSecret  = req.headers['x-admin-secret'] || '';

  const bearerToken = authHdr.startsWith('Bearer ') ? authHdr.slice(7) : null;

  // Master: either a signed session token (preferred) or legacy raw secret (kept for backward compat during rollover)
  const masterTokenPayload = xMaster ? verifyMasterToken(xMaster) : null;
  const isMasterLegacy     = !masterTokenPayload && MASTER_ADMIN_SECRET && xSecret === MASTER_ADMIN_SECRET;
  const isMaster           = !!masterTokenPayload || isMasterLegacy;

  const isAdmin    = !isMaster && ADMIN_SECRET && xSecret === ADMIN_SECRET;
  const jwtPayload = bearerToken ? verifyJWT(bearerToken) : null;

  return { isMaster, isAdmin, jwtPayload };
}

// Checks JWT validity + that the manager's account is still active in Firestore
async function requireManagerOrMaster(req) {
  const auth = extractAuth(req);
  if (auth.isMaster) return { ok: true, performedBy: 'masteradmin', role: 'masteradmin' };
  if (auth.isAdmin && !auth.jwtPayload) return { ok: true, performedBy: 'admin', role: 'admin' };
  if (auth.jwtPayload?.managerId) {
    // Verify account is still active (catches deactivated managers whose JWT hasn't expired)
    try {
      const snap = await db.collection(MANAGERS_COL).doc(auth.jwtPayload.managerId).get();
      if (!snap.exists || snap.data().status !== 'active') return { ok: false, reason: 'deactivated' };
    } catch {
      return { ok: false, reason: 'db_error' };
    }
    return { ok: true, performedBy: auth.jwtPayload.managerId, role: auth.jwtPayload.role, displayName: auth.jwtPayload.displayName };
  }
  return { ok: false };
}

function requireMaster(req) {
  return extractAuth(req).isMaster;
}

// ─── Audit log writer ───────────────────────────────────────────────────────

async function writeAudit({ action, entity, entityId, entityTitle, performedBy, meta = {} }) {
  try {
    const id = randomUUID();
    await db.collection(AUDIT_COL).doc(id).set({
      id,
      timestamp: new Date().toISOString(),
      action,
      entity,
      entityId: entityId || '',
      entityTitle: entityTitle || '',
      performedBy: performedBy || 'unknown',
      meta,
    });
  } catch (e) {
    console.error('Audit write failed:', e.message);
  }
}

// ─── Cloud Function entry point ────────────────────────────────────────────

functions.http('handler', async (req, res) => {
  const origin = req.headers['origin'] || '';
  const corsHeaders = buildCorsHeaders(origin);

  // Set CORS headers on every response
  res.set(corsHeaders);
  res.set('Content-Type', 'application/json');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  try {
    await _handler(req, res, corsHeaders);
  } catch (err) {
    console.error('Unhandled Cloud Function error', err);
    res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
});

async function _handler(req, res) {
  const method = req.method;
  const rawPath = req.path || '/';
  const path = rawPath.replace(/\/$/, '') || '/';

  // req.body is already parsed by the Functions Framework (express under the hood)
  const body = req.body || {};

  // Shorthand response helper
  const r = (status, data) => res.status(status).json(data);

  // ── POST /auth/login ─────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/login') {
    const { username, password } = body;
    if (!username || !password) return r(400, { error: 'username and password required' });
    if (typeof username !== 'string' || typeof password !== 'string') return r(400, { error: 'username and password must be strings' });

    const ip = sourceIp(req);
    const ua = userAgent(req);

    let manager;
    try {
      const snap = await db.collection(MANAGERS_COL).where('username', '==', username).get();
      manager = snap.empty ? null : snap.docs[0].data();
    } catch (e) {
      console.error('Login query failed:', e);
      return r(500, { error: 'Login temporarily unavailable' });
    }

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_SECS = 900; // 15 minutes

    const fail = async (reason) => {
      if (manager) {
        const attempts = (manager.failedLoginAttempts || 0) + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_SECS * 1000).toISOString() : null;
        const updateData = lockedUntil
          ? { failedLoginAttempts: attempts, lockedUntil }
          : { failedLoginAttempts: attempts };
        await db.collection(MANAGERS_COL).doc(manager.managerId).update(updateData);
      }
      await writeAudit({
        action: 'LOGIN_FAIL', entity: 'manager', entityId: username,
        entityTitle: username, performedBy: 'system',
        meta: { ip, userAgent: ua, reason },
      });
      return r(401, { error: 'Invalid credentials' });
    };

    if (!manager || manager.status !== 'active') return fail('not_found_or_inactive');

    if (manager.lockedUntil && new Date(manager.lockedUntil) > new Date()) {
      await writeAudit({
        action: 'LOGIN_BLOCKED', entity: 'manager', entityId: username,
        entityTitle: username, performedBy: 'system',
        meta: { ip, userAgent: ua, lockedUntil: manager.lockedUntil },
      });
      return r(429, { error: 'Account temporarily locked. Try again in 15 minutes.' });
    }

    const valid = await verifyPassword(password, manager.passwordHash || '');
    if (!valid) return fail('wrong_password');

    const token = makeJWT({ managerId: manager.managerId, username: manager.username, displayName: manager.displayName, role: manager.role });

    await db.collection(MANAGERS_COL).doc(manager.managerId).update({
      lastLoginAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      lockedUntil: Firestore.FieldValue ? Firestore.FieldValue.delete() : null,
    });

    await writeAudit({
      action: 'LOGIN_SUCCESS', entity: 'manager',
      entityId: manager.managerId, entityTitle: manager.displayName,
      performedBy: manager.managerId, meta: { ip, userAgent: ua },
    });

    return r(200, { token, managerId: manager.managerId, displayName: manager.displayName, role: manager.role });
  }

  // ── POST /auth/masterlogin ───────────────────────────────────────────────
  // Validates master password server-side; returns a signed session token.
  // The raw MASTER_ADMIN_SECRET never leaves the function — it is NOT in the browser bundle.
  if (method === 'POST' && path === '/auth/masterlogin') {
    const { password } = body;
    if (!password) return r(400, { error: 'password required' });
    if (!MASTER_ADMIN_SECRET) return r(503, { error: 'Master auth not configured' });

    // Constant-time comparison to prevent timing attacks
    const provided = Buffer.from(String(password));
    const expected = Buffer.from(MASTER_ADMIN_SECRET);
    const valid = provided.length === expected.length && timingSafeEqual(provided, expected);

    if (!valid) {
      await writeAudit({
        action: 'MASTER_LOGIN_FAIL', entity: 'masteradmin', entityId: 'masteradmin',
        entityTitle: 'masteradmin', performedBy: 'system',
        meta: { ip: sourceIp(req), userAgent: userAgent(req) },
      });
      return r(401, { error: 'Invalid master password' });
    }

    const token = makeMasterToken();
    await writeAudit({
      action: 'MASTER_LOGIN_SUCCESS', entity: 'masteradmin', entityId: 'masteradmin',
      entityTitle: 'masteradmin', performedBy: 'masteradmin',
      meta: { ip: sourceIp(req), userAgent: userAgent(req) },
    });
    return r(200, { token, expiresIn: MASTER_TOKEN_TTL_SECS });
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/logout') {
    // Logout accepts JWT or master secret; do not do active-status DB check here
    // (manager should be able to log out even if deactivated)
    const auth = extractAuth(req);
    const isMaster = auth.isMaster;
    const isAdmin  = auth.isAdmin;
    const jwt      = auth.jwtPayload;
    if (!isMaster && !isAdmin && !jwt?.managerId) return r(401, { error: 'Unauthorized' });
    const performedBy   = isMaster ? 'masteradmin' : isAdmin ? 'admin' : jwt.managerId;
    const displayName   = jwt?.displayName || performedBy;
    await writeAudit({
      action: 'LOGOUT', entity: 'manager', entityId: performedBy,
      entityTitle: displayName, performedBy,
      meta: { ip: sourceIp(req) },
    });
    return r(200, { ok: true });
  }

  // ── POST /analytics ──────────────────────────────────────────────────────
  if (method === 'POST' && path === '/analytics') {
    const ALLOWED_TYPES = ['article_view','search','chatbot_open','chatbot_persona_select','chatbot_message','ticket_submit','faq_feedback','admin_login_fail','cta_click','page_view'];
    const { eventType, sessionId, articleId, articleTitle, category, searchTerm, searchResultCount, feedbackType, persona, chatInput, ticketCategory, ctaName, ctaTarget, page, referrer, screenResolution, timezone } = body;
    if (!ALLOWED_TYPES.includes(eventType)) return r(400, { error: 'Invalid eventType' });

    // faq_feedback: use deterministic id = sessionId#articleId so a session can
    // only cast one vote per article — second write silently overwrites (idempotent).
    const resolvedSessionId = sessionId || 'unknown';
    const itemId = (eventType === 'faq_feedback' && resolvedSessionId !== 'unknown' && articleId)
      ? `fb#${resolvedSessionId}#${articleId}`
      : randomUUID();

    const ua = userAgent(req);
    const browserInfo = parseBrowser(ua);
    await db.collection(ANALYTICS_COL).doc(itemId).set({
      id: itemId,
      eventType,
      timestamp: new Date().toISOString(),
      sessionId: resolvedSessionId,
      articleId: articleId || null,
      articleTitle: articleTitle || null,
      category: category || null,
      searchTerm: searchTerm || null,
      searchResultCount: searchResultCount ?? null,
      feedbackType: feedbackType || null,
      persona: persona || null,
      chatInput: chatInput ? String(chatInput).slice(0, 200) : null,
      ticketCategory: ticketCategory || null,
      ctaName: ctaName || null,
      ctaTarget: ctaTarget || null,
      page: page || null,
      referrer: referrer || null,
      screenResolution: screenResolution || null,
      timezone: timezone || null,
      ipAddress: sourceIp(req),
      userAgent: ua,
      browser: browserInfo.browser,
      os: browserInfo.os,
      device: browserInfo.device,
    });
    return r(200, { ok: true });
  }

  // ── GET /analytics/summary ───────────────────────────────────────────────
  if (method === 'GET' && path === '/analytics/summary') {
    if (!requireMaster(req)) return r(403, { error: 'Forbidden' });
    const days = parseInt(req.query?.days || '30', 10);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const snap = await db.collection(ANALYTICS_COL).where('timestamp', '>=', since).get();
      const items = snap.docs.map(d => d.data());
      const summary = {
        period_days: days,
        article_views: 0,
        searches: 0,
        chatbot_opens: 0,
        chatbot_messages: 0,
        ticket_submits: 0,
        faq_feedback_helpful: 0,
        faq_feedback_not_helpful: 0,
        top_articles: {},
        top_searches: {},
        persona_counts: {},
        tickets_by_category: {},
        article_feedback: {},
        zero_result_searches: 0,
        cta_open_account: 0,
        cta_login: 0,
        browser_counts: {},
        os_counts: {},
        device_counts: {},
      };
      for (const item of items) {
        if (item.eventType === 'article_view') {
          summary.article_views++;
          if (item.articleTitle) summary.top_articles[item.articleTitle] = (summary.top_articles[item.articleTitle] || 0) + 1;
        } else if (item.eventType === 'search') {
          summary.searches++;
          if (item.searchTerm) summary.top_searches[item.searchTerm] = (summary.top_searches[item.searchTerm] || 0) + 1;
          if (item.searchResultCount === 0) summary.zero_result_searches++;
        } else if (item.eventType === 'chatbot_open') {
          summary.chatbot_opens++;
        } else if (item.eventType === 'chatbot_message') {
          summary.chatbot_messages++;
        } else if (item.eventType === 'ticket_submit') {
          summary.ticket_submits++;
          if (item.ticketCategory) summary.tickets_by_category[item.ticketCategory] = (summary.tickets_by_category[item.ticketCategory] || 0) + 1;
        } else if (item.eventType === 'faq_feedback') {
          if (item.feedbackType === 'helpful') summary.faq_feedback_helpful++;
          else summary.faq_feedback_not_helpful++;
          const fbKey = item.articleTitle || item.articleId || null;
          if (fbKey) {
            if (!summary.article_feedback[fbKey]) summary.article_feedback[fbKey] = { helpful: 0, not_helpful: 0, category: item.category || '' };
            if (item.feedbackType === 'helpful') summary.article_feedback[fbKey].helpful++;
            else summary.article_feedback[fbKey].not_helpful++;
          }
        } else if (item.eventType === 'chatbot_persona_select') {
          if (item.persona) summary.persona_counts[item.persona] = (summary.persona_counts[item.persona] || 0) + 1;
        } else if (item.eventType === 'cta_click') {
          if (item.ctaName === 'open_account') summary.cta_open_account++;
          else if (item.ctaName === 'login') summary.cta_login++;
        }
        if (item.browser) summary.browser_counts[item.browser] = (summary.browser_counts[item.browser] || 0) + 1;
        if (item.os) summary.os_counts[item.os] = (summary.os_counts[item.os] || 0) + 1;
        if (item.device) summary.device_counts[item.device] = (summary.device_counts[item.device] || 0) + 1;
      }
      summary.top_articles = Object.entries(summary.top_articles).sort((a, b) => b[1] - a[1]).slice(0, 10);
      summary.top_searches = Object.entries(summary.top_searches).sort((a, b) => b[1] - a[1]).slice(0, 20);
      summary.article_feedback = Object.entries(summary.article_feedback)
        .map(([title, d]) => ({ title, category: d.category, helpful: d.helpful, not_helpful: d.not_helpful, total: d.helpful + d.not_helpful, pct: Math.round((d.helpful / (d.helpful + d.not_helpful)) * 100) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);
      return r(200, summary);
    } catch (e) {
      console.error('Analytics summary error:', e);
      return r(500, { error: 'Failed to load analytics' });
    }
  }

  // ── GET /managers ─────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/managers') {
    if (!requireMaster(req)) return r(403, { error: 'Forbidden' });
    const snap = await db.collection(MANAGERS_COL).get();
    const items = snap.docs
      .map(d => {
        const m = d.data();
        // Only return safe fields (exclude passwordHash)
        return {
          managerId: m.managerId,
          username: m.username,
          displayName: m.displayName,
          email: m.email,
          role: m.role,
          status: m.status,
          createdAt: m.createdAt,
          lastLoginAt: m.lastLoginAt,
          deactivatedAt: m.deactivatedAt,
          createdBy: m.createdBy,
        };
      })
      .filter(m => m.managerId && m.username);
    return r(200, items);
  }

  // ── POST /managers ────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/managers') {
    if (!requireMaster(req)) return r(403, { error: 'Forbidden' });
    const { username, displayName, email, role, password } = body;
    if (!username || !displayName || !email || !password) return r(400, { error: 'username, displayName, email, password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return r(400, { error: 'Invalid email format' });
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return r(400, { error: 'Username must be 3-30 alphanumeric/underscore characters' });
    if (password.length < 8) return r(400, { error: 'Password must be at least 8 characters' });
    const allowed_roles = ['manager', 'senior_manager'];
    if (role && !allowed_roles.includes(role)) return r(400, { error: `Invalid role. Allowed: ${allowed_roles.join(', ')}` });
    const managerRole = role || 'manager';

    // Check username uniqueness
    const existingByUsername = await db.collection(MANAGERS_COL).where('username', '==', username).get();
    if (!existingByUsername.empty) return r(409, { error: 'Username already exists' });

    // Check email uniqueness
    const existingByEmail = await db.collection(MANAGERS_COL).where('email', '==', email).get();
    if (!existingByEmail.empty) return r(409, { error: 'Email already in use' });

    const managerId = `mgr_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const passwordHash = await hashPassword(password);

    await db.collection(MANAGERS_COL).doc(managerId).set({
      id: managerId, managerId, username, displayName, email, role: managerRole,
      status: 'active', passwordHash,
      createdAt: new Date().toISOString(),
      createdBy: 'masteradmin',
      lastLoginAt: null, deactivatedAt: null,
    });

    await writeAudit({
      action: 'MANAGER_CREATED', entity: 'manager',
      entityId: managerId, entityTitle: displayName,
      performedBy: 'masteradmin', meta: { username, email, role: managerRole },
    });

    return r(201, { managerId, ok: true });
  }

  // ── PUT /managers/{id} ────────────────────────────────────────────────────
  const managerPutMatch = path.match(/^\/managers\/([^/]+)$/);
  if (method === 'PUT' && managerPutMatch) {
    if (!requireMaster(req)) return r(403, { error: 'Forbidden' });
    const managerId = managerPutMatch[1];
    const updateData = {};
    const updates = {};

    if (body.status !== undefined) {
      const allowed = ['active', 'deactivated'];
      if (!allowed.includes(body.status)) return r(400, { error: 'Invalid status' });
      updateData.status = body.status;
      updates.status = body.status;
      if (body.status === 'deactivated') {
        updateData.deactivatedAt = new Date().toISOString();
      }
    }
    if (body.password) {
      if (body.password.length < 8) return r(400, { error: 'Password too short' });
      updateData.passwordHash = await hashPassword(body.password);
      updates.passwordReset = true;
    }
    if (body.displayName) {
      updateData.displayName = body.displayName;
      updates.displayName = body.displayName;
    }
    if (body.role) {
      const allowed = ['manager', 'senior_manager'];
      if (!allowed.includes(body.role)) return r(400, { error: 'Invalid role' });
      updateData.role = body.role;
      updates.role = body.role;
    }
    if (!Object.keys(updateData).length) return r(400, { error: 'Nothing to update' });

    const existingSnap = await db.collection(MANAGERS_COL).doc(managerId).get();
    if (!existingSnap.exists) return r(404, { error: 'Manager not found' });

    await db.collection(MANAGERS_COL).doc(managerId).update(updateData);

    await writeAudit({
      action: 'MANAGER_UPDATED', entity: 'manager',
      entityId: managerId, entityTitle: managerId,
      performedBy: 'masteradmin', meta: updates,
    });

    return r(200, { ok: true });
  }

  // ── DELETE /managers/{id} ─────────────────────────────────────────────────
  const managerDeleteMatch = path.match(/^\/managers\/([^/]+)$/);
  if (method === 'DELETE' && managerDeleteMatch) {
    if (!requireMaster(req)) return r(403, { error: 'Forbidden' });
    const managerId = managerDeleteMatch[1];
    const existingSnap = await db.collection(MANAGERS_COL).doc(managerId).get();
    if (!existingSnap.exists) return r(404, { error: 'Manager not found' });
    const existing = existingSnap.data();
    await db.collection(MANAGERS_COL).doc(managerId).delete();
    await writeAudit({
      action: 'MANAGER_DELETED', entity: 'manager',
      entityId: managerId, entityTitle: existing.username || managerId,
      performedBy: 'masteradmin', meta: { username: existing.username },
    });
    return r(200, { ok: true });
  }

  // ── GET /faq ──────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/faq') {
    const auth = await requireManagerOrMaster(req);
    const categoryFilter = req.query?.category;
    const snap = await db.collection(FAQ_COL).get();
    let items = snap.docs.map(d => d.data());
    // Public users only see published articles; authenticated managers see all
    if (!auth.ok) {
      items = items.filter(i => i.status === 'published');
    }
    if (categoryFilter) {
      const filterLower = categoryFilter.toLowerCase();
      items = items.filter(i => i.category?.toLowerCase() === filterLower);
    }
    items.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
    return r(200, items);
  }

  // ── GET /faq/search?q=... ─────────────────────────────────────────────────
  // Smart KB search: returns top N articles ranked by relevance to query.
  // Public endpoint — only returns published articles.
  // Scoring: title (10x) > category (3x) > content (1x). Fuzzy matches each query word.
  if (method === 'GET' && path === '/faq/search') {
    const q = String(req.query?.q || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query?.limit || '5', 10) || 5, 20);
    if (!q || q.length < 2) return r(200, { results: [], total: 0, query: q });

    const snap = await db.collection(FAQ_COL).get();
    const items = snap.docs.map(d => d.data()).filter(i => i.status === 'published');

    // Split query into individual words for multi-word matching
    const words = q.split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return r(200, { results: [], total: 0, query: q });

    const scored = items.map(article => {
      const title    = (article.title    || '').toLowerCase();
      const category = (article.category || '').toLowerCase();
      const content  = (article.content  || '').toLowerCase().replace(/<[^>]+>/g, ' ');

      let score = 0;
      let matchedWords = 0;

      for (const w of words) {
        const inTitle    = title.includes(w);
        const inCategory = category.includes(w);
        const inContent  = content.includes(w);
        if (inTitle || inCategory || inContent) matchedWords++;
        if (inTitle)    score += 10;
        if (inCategory) score += 3;
        if (inContent)  score += 1;
      }

      // Boost: exact full-phrase match in title is strongest signal
      if (title.includes(q))    score += 25;
      if (category.includes(q)) score += 8;

      // Penalty: only matched some words (likely irrelevant)
      if (matchedWords < words.length) score = score * (matchedWords / words.length);

      // Extract a snippet around the first match in content
      let snippet = '';
      if (content) {
        const firstMatch = words.map(w => content.indexOf(w)).filter(i => i >= 0).sort((a, b) => a - b)[0];
        if (firstMatch !== undefined && firstMatch >= 0) {
          const start = Math.max(0, firstMatch - 50);
          const end = Math.min(content.length, firstMatch + 150);
          snippet = (start > 0 ? '…' : '') + content.slice(start, end).trim() + (end < content.length ? '…' : '');
        } else {
          snippet = content.slice(0, 150) + (content.length > 150 ? '…' : '');
        }
      }

      return {
        id: article.id,
        title: article.title,
        category: article.category,
        snippet,
        updatedAt: article.updatedAt || article.createdAt,
        score,
      };
    });

    const results = scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      // Remove internal score before returning
      .map(({ score, ...rest }) => rest);

    return r(200, { results, total: results.length, query: q });
  }

  // ── POST /faq ─────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/faq') {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const { title, category, content, status = 'published', id, sortOrder } = body;

    if (id && !title && !content) {
      // Status-only toggle
      if (body.status && !VALID_FAQ_STATUSES.includes(body.status)) return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
      const existingSnap = await db.collection(FAQ_COL).doc(id).get();
      if (!existingSnap.exists) return r(404, { error: 'Article not found' });
      await db.collection(FAQ_COL).doc(id).update({
        status: body.status || 'published',
        updatedAt: new Date().toISOString(),
      });
      await writeAudit({ action: 'UPDATE_FAQ', entity: 'faq', entityId: id, entityTitle: existingSnap.data().title, performedBy: auth.performedBy, meta: { newStatus: body.status } });
      return r(200, { ok: true });
    }

    if (!title || !category || !content) return r(400, { error: 'title, category, content required' });
    if (title.length > 300) return r(400, { error: 'title too long (max 300 chars)' });
    if (content.length > 50000) return r(400, { error: 'content too long (max 50000 chars)' });
    if (!VALID_FAQ_STATUSES.includes(status)) return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
    const newId = id || `art-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();
    const item = { id: newId, title, category, content, status, createdAt: now, updatedAt: now };
    if (sortOrder !== undefined) item.sortOrder = sortOrder;
    await db.collection(FAQ_COL).doc(newId).set(item);
    await writeAudit({ action: 'CREATE_FAQ', entity: 'faq', entityId: newId, entityTitle: title, performedBy: auth.performedBy, meta: { category, status } });
    return r(201, { id: newId, ok: true });
  }

  // ── PUT /faq/{id} ─────────────────────────────────────────────────────────
  const faqPutMatch = path.match(/^\/faq\/([^/]+)$/);
  if (method === 'PUT' && faqPutMatch) {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = faqPutMatch[1];
    const { title, category, content, status, sortOrder } = body;

    // Reject empty body PUTs
    if (!title && !category && !content && status === undefined && sortOrder === undefined) return r(400, { error: 'Nothing to update' });

    if (status !== undefined && !VALID_FAQ_STATUSES.includes(status)) {
      return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
    }

    const existingSnap = await db.collection(FAQ_COL).doc(id).get();
    if (!existingSnap.exists) return r(404, { error: 'Article not found' });

    const updateData = { updatedAt: new Date().toISOString() };
    if (title) updateData.title = title;
    if (category) updateData.category = category;
    if (content) updateData.content = content;
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    await db.collection(FAQ_COL).doc(id).update(updateData);
    await writeAudit({ action: 'UPDATE_FAQ', entity: 'faq', entityId: id, entityTitle: title || existingSnap.data().title || id, performedBy: auth.performedBy, meta: { fieldsChanged: Object.keys(body) } });
    return r(200, { ok: true });
  }

  // ── DELETE /faq/{id} ──────────────────────────────────────────────────────
  const faqDeleteMatch = path.match(/^\/faq\/([^/]+)$/);
  if (method === 'DELETE' && faqDeleteMatch) {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = faqDeleteMatch[1];
    const existingSnap = await db.collection(FAQ_COL).doc(id).get();
    if (!existingSnap.exists) return r(404, { error: 'Article not found' });
    const title = existingSnap.data().title || id;
    await db.collection(FAQ_COL).doc(id).delete();
    await writeAudit({ action: 'DELETE_FAQ', entity: 'faq', entityId: id, entityTitle: title, performedBy: auth.performedBy });
    return r(200, { ok: true });
  }

  // ── GET /tickets ──────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/tickets') {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const snap = await db.collection(TICKETS_COL).get();
    const items = snap.docs
      .map(d => d.data())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    await writeAudit({
      action: 'TICKETS_VIEWED', entity: 'ticket', entityId: 'all',
      entityTitle: `${items.length} tickets`, performedBy: auth.performedBy,
      meta: { count: items.length },
    });
    return r(200, items);
  }

  // ── POST /tickets ─────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/tickets') {
    const { name, email, category, subject, description, status = 'open', createdAt, sessionId, phone } = body;

    // Required field validation
    if (!name || !email || !subject) return r(400, { error: 'name, email, subject required' });

    // Whitespace-only check
    if (!name.trim()) return r(400, { error: 'name cannot be blank' });
    if (!subject.trim()) return r(400, { error: 'subject cannot be blank' });
    if (description !== undefined && description !== null && !String(description).trim()) return r(400, { error: 'description cannot be blank' });

    // Length limits
    if (name.trim().length > 100) return r(400, { error: 'name too long (max 100 chars)' });
    if (subject.length > 300) return r(400, { error: 'subject too long (max 300 chars)' });
    if (description && description.length > 5000) return r(400, { error: 'description too long (max 5000 chars)' });

    // Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return r(400, { error: 'Invalid email format' });

    // Phone format (optional field — if provided must be digits/spaces/+/-)
    if (phone !== undefined && phone !== null && phone !== '') {
      if (!/^[+\d\s\-()]{7,20}$/.test(String(phone))) return r(400, { error: 'Invalid phone format' });
    }

    // Category allow-list (optional, defaults to Other)
    const resolvedCategory = category || 'Other';
    if (!ALLOWED_TICKET_CATEGORIES.includes(resolvedCategory)) {
      return r(400, { error: `Invalid category. Allowed: ${ALLOWED_TICKET_CATEGORIES.join(', ')}` });
    }

    // Status check
    if (status !== 'open' && !VALID_TICKET_STATUSES.includes(status)) return r(400, { error: 'Invalid ticket status' });

    const ticketId = `TIC-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();
    const ticketItem = {
      id: ticketId, name: name.trim(), email, category: resolvedCategory,
      subject: subject.trim(), description: description ? String(description).trim() : '',
      status,
      createdAt: now, date: now.slice(0, 10),
      ipAddress: sourceIp(req),
      userAgent: userAgent(req),
      sessionId: sessionId || 'unknown',
    };
    if (phone) ticketItem.phone = String(phone).trim();
    await db.collection(TICKETS_COL).doc(ticketId).set(ticketItem);
    await writeAudit({
      action: 'CREATE_TICKET', entity: 'ticket',
      entityId: ticketId, entityTitle: subject,
      performedBy: 'public', meta: { name, email, category: resolvedCategory, ip: sourceIp(req) },
    });
    return r(201, { id: ticketId, ok: true });
  }

  // ── PUT /tickets/{id} ─────────────────────────────────────────────────────
  const ticketPutMatch = path.match(/^\/tickets\/([^/]+)$/);
  if (method === 'PUT' && ticketPutMatch) {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = ticketPutMatch[1];

    // Reject empty body PUTs
    if (!body.status && !body.notes && !body.assignedTo) return r(400, { error: 'Nothing to update' });

    const existingSnap = await db.collection(TICKETS_COL).doc(id).get();
    if (!existingSnap.exists) return r(404, { error: 'Ticket not found' });
    const existing = existingSnap.data();
    const oldStatus = existing.status;
    const newStatus = body.status || oldStatus;
    if (!VALID_TICKET_STATUSES.includes(newStatus)) return r(400, { error: 'Invalid status. Allowed: open, in_progress, solved, resolved' });
    await db.collection(TICKETS_COL).doc(id).update({
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    await writeAudit({
      action: 'UPDATE_TICKET', entity: 'ticket',
      entityId: id, entityTitle: existing.subject || id,
      performedBy: auth.performedBy,
      meta: { oldStatus, newStatus },
    });
    return r(200, { ok: true });
  }

  // ── GET /audit-log ─────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/audit-log') {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });

    let items;
    if (auth.role === 'manager') {
      // Use Firestore where() query for O(1) manager-scoped lookup (replaces GSI)
      const snap = await db.collection(AUDIT_COL)
        .where('performedBy', '==', auth.performedBy)
        .orderBy('timestamp', 'desc')
        .limit(500)
        .get();
      items = snap.docs.map(d => d.data());
    } else {
      // Master admin: full collection with a safety cap
      const snap = await db.collection(AUDIT_COL).orderBy('timestamp', 'desc').limit(1000).get();
      items = snap.docs.map(d => d.data());
    }

    return r(200, items);
  }

  // ── GET /categories ──────────────────────────────────────────────────────
  if (method === 'GET' && path === '/categories') {
    const snap = await db.collection(CATEGORIES_COL).get();
    const items = snap.docs
      .map(d => d.data())
      .sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
    return r(200, items);
  }

  // ── POST /categories ──────────────────────────────────────────────────────
  if (method === 'POST' && path === '/categories') {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const { name, icon, parentId, sortOrder } = body;
    if (!name || !name.trim()) return r(400, { error: 'name required' });
    if (name.length > 100) return r(400, { error: 'name too long (max 100 chars)' });
    const id = `cat-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();
    await db.collection(CATEGORIES_COL).doc(id).set({
      id,
      name: name.trim(),
      icon: icon || 'fas fa-folder',
      parentId: parentId || null,
      sortOrder: sortOrder ?? 999999,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await writeAudit({ action: 'CREATE_CATEGORY', entity: 'category', entityId: id, entityTitle: name.trim(), performedBy: auth.performedBy, meta: { parentId: parentId || 'none' } });
    return r(201, { id, ok: true });
  }

  // ── PUT /categories/{id} ──────────────────────────────────────────────────
  const catPutMatch = path.match(/^\/categories\/([^/]+)$/);
  if (method === 'PUT' && catPutMatch) {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const catId = catPutMatch[1];
    const existingSnap = await db.collection(CATEGORIES_COL).doc(catId).get();
    if (!existingSnap.exists) return r(404, { error: 'Category not found' });
    const updateData = { updatedAt: new Date().toISOString() };
    if (body.name) updateData.name = body.name.trim();
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.status !== undefined) {
      if (!['active', 'inactive'].includes(body.status)) return r(400, { error: 'Invalid status' });
      updateData.status = body.status;
    }
    await db.collection(CATEGORIES_COL).doc(catId).update(updateData);
    await writeAudit({ action: 'UPDATE_CATEGORY', entity: 'category', entityId: catId, entityTitle: body.name || existingSnap.data().name, performedBy: auth.performedBy, meta: { fieldsChanged: Object.keys(body) } });
    return r(200, { ok: true });
  }

  // ── DELETE /categories/{id} ───────────────────────────────────────────────
  const catDeleteMatch = path.match(/^\/categories\/([^/]+)$/);
  if (method === 'DELETE' && catDeleteMatch) {
    const auth = await requireManagerOrMaster(req);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const catId = catDeleteMatch[1];
    const existingSnap = await db.collection(CATEGORIES_COL).doc(catId).get();
    if (!existingSnap.exists) return r(404, { error: 'Category not found' });
    await db.collection(CATEGORIES_COL).doc(catId).delete();
    await writeAudit({ action: 'DELETE_CATEGORY', entity: 'category', entityId: catId, entityTitle: existingSnap.data().name, performedBy: auth.performedBy });
    return r(200, { ok: true });
  }

  return r(404, { error: 'Not found' });
}
