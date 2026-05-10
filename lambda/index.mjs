/**
 * ibulls-faq-api  —  Node.js 22.x Lambda (ES Module)
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
 *   POST   /analytics              public  → writes to ib-analytics
 *   GET    /analytics/summary      master session token → aggregated stats
 *
 *   GET    /managers               master session token
 *   POST   /managers               master session token
 *   PUT    /managers/{id}          master session token
 *   DELETE /managers/{id}          master session token
 *
 * Env vars:
 *   ADMIN_SECRET          shared secret checked against X-Admin-Secret for manager-level access
 *   MASTER_ADMIN_SECRET   master password — NEVER sent to the browser; validated server-side only
 *   JWT_SECRET            HMAC-SHA256 signing key for manager tokens AND master session tokens
 *   DYNAMODB_TABLE        (defaults to ibulls-faq-articles)
 *   TICKETS_TABLE         (defaults to ib-tickets)
 *   AUDIT_TABLE           (defaults to ib-audit-log)
 *   ANALYTICS_TABLE       (defaults to ib-analytics)
 *   MANAGERS_TABLE        (defaults to ib-managers)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { createHmac, randomUUID } from 'crypto';
import { scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// ─── Config ────────────────────────────────────────────────────────────────

const REGION            = process.env.AWS_REGION || 'ap-southeast-2';
const FAQ_TABLE         = process.env.DYNAMODB_TABLE    || 'ibulls-faq-articles';
const TICKETS_TABLE     = process.env.TICKETS_TABLE     || 'ib-tickets';
const AUDIT_TABLE       = process.env.AUDIT_TABLE       || 'ib-audit-log';
const ANALYTICS_TABLE   = process.env.ANALYTICS_TABLE   || 'ib-analytics';
const MANAGERS_TABLE    = process.env.MANAGERS_TABLE    || 'ib-managers';

const ADMIN_SECRET        = process.env.ADMIN_SECRET        || '';
const MASTER_ADMIN_SECRET = process.env.MASTER_ADMIN_SECRET || '';
const JWT_SECRET          = process.env.JWT_SECRET          || (() => { throw new Error('JWT_SECRET env var is required'); })();

// Fail-fast: warn loudly if privileged secrets are missing — prevents silent open-door scenarios
if (!ADMIN_SECRET)        console.error('[STARTUP] WARNING: ADMIN_SECRET is not set — manager header auth is disabled');
if (!MASTER_ADMIN_SECRET) console.error('[STARTUP] WARNING: MASTER_ADMIN_SECRET is not set — /auth/masterlogin will return 503');

const TOKEN_TTL_SECS        = 7200;  // 2 hours — manager JWT
const MASTER_TOKEN_TTL_SECS = 28800; // 8 hours — master session token

const client = new DynamoDBClient({ region: REGION });
const ddb    = DynamoDBDocumentClient.from(client);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const VALID_FAQ_STATUSES    = ['published', 'draft'];
const VALID_TICKET_STATUSES = ['open', 'in_progress', 'solved', 'resolved'];
const ALLOWED_TICKET_CATEGORIES = [
  'Getting Started', 'Account Opening', 'Trading', 'Portfolio & Margin',
  'Funds', 'Charges & Brokerage', 'Compliance & Safety', 'Mutual Funds',
  'IPO', 'F&O', 'Pledging', 'MTF', 'Tender Offers', 'Contact & Help',
  'Advanced', 'Account', 'Reports', 'NRI/HUF Accounts', 'Other',
];

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const allowed = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin':  allowed || (ALLOWED_ORIGINS.length === 0 ? '*' : ''),
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Secret,Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function resp(status, body, extra = {}, event = {}) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(event), ...extra },
    body: JSON.stringify(body),
  };
}

function sourceIp(event) {
  return (
    event.requestContext?.http?.sourceIp ||
    event.requestContext?.identity?.sourceIp ||
    'unknown'
  );
}

function userAgent(event) {
  const ua = event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '';
  return ua.slice(0, 300);
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

// ─── Password hashing (scrypt — no native modules needed) ──────────────────

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
  const payload = verifyJWT(token); // same HMAC structure, re-uses verifyJWT
  return payload?.role === 'masteradmin' ? payload : null;
}

function extractAuth(event) {
  const authHdr  = event.headers?.['authorization'] || event.headers?.['Authorization'] || '';
  const xMaster  = event.headers?.['x-master-token'] || event.headers?.['X-Master-Token'] || '';
  const xSecret  = event.headers?.['x-admin-secret'] || event.headers?.['X-Admin-Secret'] || '';

  const bearerToken = authHdr.startsWith('Bearer ') ? authHdr.slice(7) : null;

  // Master: either a signed session token (preferred) or legacy raw secret (kept for backward compat during rollover)
  const masterTokenPayload = xMaster ? verifyMasterToken(xMaster) : null;
  const isMasterLegacy     = !masterTokenPayload && MASTER_ADMIN_SECRET && xSecret === MASTER_ADMIN_SECRET;
  const isMaster           = !!masterTokenPayload || isMasterLegacy;

  const isAdmin    = !isMaster && ADMIN_SECRET && xSecret === ADMIN_SECRET;
  const jwtPayload = bearerToken ? verifyJWT(bearerToken) : null;

  return { isMaster, isAdmin, jwtPayload };
}

// Checks JWT validity + that the manager's account is still active in DynamoDB
async function requireManagerOrMaster(event) {
  const auth = extractAuth(event);
  if (auth.isMaster) return { ok: true, performedBy: 'masteradmin', role: 'masteradmin' };
  if (auth.isAdmin && !auth.jwtPayload) return { ok: true, performedBy: 'admin', role: 'admin' };
  if (auth.jwtPayload?.managerId) {
    // Verify account is still active (catches deactivated managers whose JWT hasn't expired)
    try {
      const res = await ddb.send(new GetCommand({
        TableName: MANAGERS_TABLE,
        Key: { id: auth.jwtPayload.managerId },
        ProjectionExpression: '#s',
        ExpressionAttributeNames: { '#s': 'status' },
      }));
      if (!res.Item || res.Item.status !== 'active') return { ok: false, reason: 'deactivated' };
    } catch {
      return { ok: false, reason: 'db_error' };
    }
    return { ok: true, performedBy: auth.jwtPayload.managerId, role: auth.jwtPayload.role, displayName: auth.jwtPayload.displayName };
  }
  return { ok: false };
}

function requireMaster(event) {
  return extractAuth(event).isMaster;
}

// ─── Audit log writer ───────────────────────────────────────────────────────

async function writeAudit({ action, entity, entityId, entityTitle, performedBy, meta = {} }) {
  try {
    await ddb.send(new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        action,
        entity,
        entityId: entityId || '',
        entityTitle: entityTitle || '',
        performedBy: performedBy || 'unknown',
        meta,
      },
    }));
  } catch (e) {
    console.error('Audit write failed:', e.message);
  }
}

// ─── Router ────────────────────────────────────────────────────────────────

export async function handler(event) {
  const r = (status, body, extra = {}) => resp(status, body, extra, event);

  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const rawPath = event.rawPath || event.path || '/';
  const path = rawPath.replace(/\/$/, '') || '/';

  if (method === 'OPTIONS') return r(200, {});

  let body = {};
  if (event.body) {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body); }
    catch { return r(400, { error: 'Invalid JSON body' }); }
  }

  // ── POST /auth/login ─────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/login') {
    const { username, password } = body;
    if (!username || !password) return r(400, { error: 'username and password required' });
    if (typeof username !== 'string' || typeof password !== 'string') return r(400, { error: 'username and password must be strings' });

    const ip = sourceIp(event);
    const ua = userAgent(event);

    let manager;
    try {
      const res = await ddb.send(new QueryCommand({
        TableName: MANAGERS_TABLE,
        IndexName: 'username-index',
        KeyConditionExpression: 'username = :u',
        ExpressionAttributeValues: { ':u': username },
      }));
      manager = res.Items?.[0];
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
        const updateExpr = lockedUntil
          ? 'SET failedLoginAttempts = :a, lockedUntil = :l'
          : 'SET failedLoginAttempts = :a';
        const exprVals = lockedUntil
          ? { ':a': attempts, ':l': lockedUntil }
          : { ':a': attempts };
        await ddb.send(new UpdateCommand({
          TableName: MANAGERS_TABLE,
          Key: { id: manager.managerId },
          UpdateExpression: updateExpr,
          ExpressionAttributeValues: exprVals,
        }));
      }
      await writeAudit({
        action: 'LOGIN_FAIL', entity: 'manager', entityId: username,
        entityTitle: username, performedBy: 'system',
        meta: { ip, userAgent: ua, reason },
      });
      return r(401, { error: 'Invalid credentials' }, {});
    };

    if (!manager || manager.status !== 'active') return fail('not_found_or_inactive');

    if (manager.lockedUntil && new Date(manager.lockedUntil) > new Date()) {
      await writeAudit({
        action: 'LOGIN_BLOCKED', entity: 'manager', entityId: username,
        entityTitle: username, performedBy: 'system',
        meta: { ip, userAgent: ua, lockedUntil: manager.lockedUntil },
      });
      return r(429, { error: 'Account temporarily locked. Try again in 15 minutes.' }, {});
    }

    const valid = await verifyPassword(password, manager.passwordHash || '');
    if (!valid) return fail('wrong_password');

    const token = makeJWT({ managerId: manager.managerId, username: manager.username, displayName: manager.displayName, role: manager.role });

    await ddb.send(new UpdateCommand({
      TableName: MANAGERS_TABLE,
      Key: { id: manager.managerId },
      UpdateExpression: 'SET lastLoginAt = :t, failedLoginAttempts = :z REMOVE lockedUntil',
      ExpressionAttributeValues: { ':t': new Date().toISOString(), ':z': 0 },
    }));

    await writeAudit({
      action: 'LOGIN_SUCCESS', entity: 'manager',
      entityId: manager.managerId, entityTitle: manager.displayName,
      performedBy: manager.managerId, meta: { ip, userAgent: ua },
    });

    return r(200, { token, managerId: manager.managerId, displayName: manager.displayName, role: manager.role });
  }

  // ── POST /auth/masterlogin ───────────────────────────────────────────────
  // Validates master password server-side; returns a signed session token.
  // The raw MASTER_ADMIN_SECRET never leaves the Lambda — it is NOT in the browser bundle.
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
        meta: { ip: sourceIp(event), userAgent: userAgent(event) },
      });
      return r(401, { error: 'Invalid master password' });
    }

    const token = makeMasterToken();
    await writeAudit({
      action: 'MASTER_LOGIN_SUCCESS', entity: 'masteradmin', entityId: 'masteradmin',
      entityTitle: 'masteradmin', performedBy: 'masteradmin',
      meta: { ip: sourceIp(event), userAgent: userAgent(event) },
    });
    return r(200, { token, expiresIn: MASTER_TOKEN_TTL_SECS });
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────
  if (method === 'POST' && path === '/auth/logout') {
    // Logout accepts JWT or master secret; do not do active-status DB check here
    // (manager should be able to log out even if deactivated)
    const auth = extractAuth(event);
    const isMaster = auth.isMaster;
    const isAdmin  = auth.isAdmin;
    const jwt      = auth.jwtPayload;
    if (!isMaster && !isAdmin && !jwt?.managerId) return r(401, { error: 'Unauthorized' });
    const performedBy   = isMaster ? 'masteradmin' : isAdmin ? 'admin' : jwt.managerId;
    const displayName   = jwt?.displayName || performedBy;
    await writeAudit({
      action: 'LOGOUT', entity: 'manager', entityId: performedBy,
      entityTitle: displayName, performedBy,
      meta: { ip: sourceIp(event) },
    });
    return r(200, { ok: true });
  }

  // ── POST /analytics ──────────────────────────────────────────────────────
  if (method === 'POST' && path === '/analytics') {
    const ALLOWED_TYPES = ['article_view','search','chatbot_open','chatbot_persona_select','chatbot_message','ticket_submit','faq_feedback','admin_login_fail'];
    const { eventType, sessionId, articleId, articleTitle, category, searchTerm, searchResultCount, feedbackType, persona, chatInput, ticketCategory } = body;
    if (!ALLOWED_TYPES.includes(eventType)) return r(400, { error: 'Invalid eventType' });
    await ddb.send(new PutCommand({
      TableName: ANALYTICS_TABLE,
      Item: {
        id: randomUUID(),
        eventType,
        timestamp: new Date().toISOString(),
        sessionId: sessionId || 'unknown',
        articleId: articleId || null,
        articleTitle: articleTitle || null,
        category: category || null,
        searchTerm: searchTerm || null,
        searchResultCount: searchResultCount ?? null,
        feedbackType: feedbackType || null,
        persona: persona || null,
        chatInput: chatInput ? String(chatInput).slice(0, 200) : null,
        ticketCategory: ticketCategory || null,
        ipAddress: sourceIp(event),
        userAgent: userAgent(event),
      },
    }));
    return r(200, { ok: true });
  }

  // ── GET /analytics/summary ───────────────────────────────────────────────
  if (method === 'GET' && path === '/analytics/summary') {
    if (!requireMaster(event)) return r(403, { error: 'Forbidden' });
    const days = parseInt(event.queryStringParameters?.days || '30', 10);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    try {
      const res = await ddb.send(new ScanCommand({
        TableName: ANALYTICS_TABLE,
        FilterExpression: '#ts >= :since',
        ExpressionAttributeNames: { '#ts': 'timestamp' },
        ExpressionAttributeValues: { ':since': since },
      }));
      const items = res.Items || [];
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
      };
      for (const item of items) {
        if (item.eventType === 'article_view') {
          summary.article_views++;
          if (item.articleTitle) summary.top_articles[item.articleTitle] = (summary.top_articles[item.articleTitle] || 0) + 1;
        } else if (item.eventType === 'search') {
          summary.searches++;
          if (item.searchTerm) summary.top_searches[item.searchTerm] = (summary.top_searches[item.searchTerm] || 0) + 1;
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
        } else if (item.eventType === 'chatbot_persona_select') {
          if (item.persona) summary.persona_counts[item.persona] = (summary.persona_counts[item.persona] || 0) + 1;
        }
      }
      summary.top_articles = Object.entries(summary.top_articles).sort((a, b) => b[1] - a[1]).slice(0, 10);
      summary.top_searches = Object.entries(summary.top_searches).sort((a, b) => b[1] - a[1]).slice(0, 20);
      return r(200, summary);
    } catch (e) {
      console.error('Analytics summary error:', e);
      return r(500, { error: 'Failed to load analytics' });
    }
  }

  // ── GET /managers ─────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/managers') {
    if (!requireMaster(event)) return r(403, { error: 'Forbidden' });
    const res = await ddb.send(new ScanCommand({
      TableName: MANAGERS_TABLE,
      ProjectionExpression: 'managerId, username, displayName, email, #r, #s, createdAt, lastLoginAt, deactivatedAt, createdBy',
      ExpressionAttributeNames: { '#r': 'role', '#s': 'status' },
    }));
    const items = (res.Items || []).filter(m => m.managerId && m.username);
    return r(200, items);
  }

  // ── POST /managers ────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/managers') {
    if (!requireMaster(event)) return r(403, { error: 'Forbidden' });
    const { username, displayName, email, role, password } = body;
    if (!username || !displayName || !email || !password) return r(400, { error: 'username, displayName, email, password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return r(400, { error: 'Invalid email format' });
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return r(400, { error: 'Username must be 3-30 alphanumeric/underscore characters' });
    if (password.length < 8) return r(400, { error: 'Password must be at least 8 characters' });
    const allowed_roles = ['manager', 'senior_manager'];
    if (role && !allowed_roles.includes(role)) return r(400, { error: `Invalid role. Allowed: ${allowed_roles.join(', ')}` });
    const managerRole = role || 'manager';

    // Check username uniqueness
    const existingByUsername = await ddb.send(new QueryCommand({
      TableName: MANAGERS_TABLE,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :u',
      ExpressionAttributeValues: { ':u': username },
    }));
    if (existingByUsername.Items?.length > 0) return r(409, { error: 'Username already exists' });

    // Check email uniqueness
    const existingByEmail = await ddb.send(new ScanCommand({
      TableName: MANAGERS_TABLE,
      FilterExpression: 'email = :e',
      ExpressionAttributeValues: { ':e': email },
    }));
    if ((existingByEmail.Items || []).length > 0) return r(409, { error: 'Email already in use' });

    const managerId = `mgr_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const passwordHash = await hashPassword(password);

    await ddb.send(new PutCommand({
      TableName: MANAGERS_TABLE,
      Item: {
        id: managerId, managerId, username, displayName, email, role: managerRole,
        status: 'active', passwordHash,
        createdAt: new Date().toISOString(),
        createdBy: 'masteradmin',
        lastLoginAt: null, deactivatedAt: null,
      },
    }));

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
    if (!requireMaster(event)) return r(403, { error: 'Forbidden' });
    const managerId = managerPutMatch[1];
    const exprParts = [];
    const exprNames = {};
    const exprVals = {};
    const updates = {};

    if (body.status !== undefined) {
      const allowed = ['active', 'deactivated'];
      if (!allowed.includes(body.status)) return r(400, { error: 'Invalid status' });
      exprParts.push('#s = :s');
      exprNames['#s'] = 'status';
      exprVals[':s'] = body.status;
      if (body.status === 'deactivated') {
        exprParts.push('deactivatedAt = :da');
        exprVals[':da'] = new Date().toISOString();
      }
      updates.status = body.status;
    }
    if (body.password) {
      if (body.password.length < 8) return r(400, { error: 'Password too short' });
      exprParts.push('passwordHash = :ph');
      exprVals[':ph'] = await hashPassword(body.password);
      updates.passwordReset = true;
    }
    if (body.displayName) {
      exprParts.push('displayName = :dn');
      exprVals[':dn'] = body.displayName;
      updates.displayName = body.displayName;
    }
    if (body.role) {
      const allowed = ['manager', 'senior_manager'];
      if (!allowed.includes(body.role)) return r(400, { error: 'Invalid role' });
      exprParts.push('#r = :r');
      exprNames['#r'] = 'role';
      exprVals[':r'] = body.role;
      updates.role = body.role;
    }
    if (!exprParts.length) return r(400, { error: 'Nothing to update' });

    const existingMgr = await ddb.send(new GetCommand({ TableName: MANAGERS_TABLE, Key: { id: managerId } }));
    if (!existingMgr.Item) return r(404, { error: 'Manager not found' });

    await ddb.send(new UpdateCommand({
      TableName: MANAGERS_TABLE,
      Key: { id: managerId },
      UpdateExpression: `SET ${exprParts.join(', ')}`,
      ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
      ExpressionAttributeValues: exprVals,
    }));

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
    if (!requireMaster(event)) return r(403, { error: 'Forbidden' });
    const managerId = managerDeleteMatch[1];
    const existing = await ddb.send(new GetCommand({ TableName: MANAGERS_TABLE, Key: { id: managerId } }));
    if (!existing.Item) return r(404, { error: 'Manager not found' });
    // Conditional delete to prevent race condition double-delete both returning 200
    await ddb.send(new DeleteCommand({
      TableName: MANAGERS_TABLE,
      Key: { id: managerId },
      ConditionExpression: 'attribute_exists(id)',
    }));
    await writeAudit({
      action: 'MANAGER_DELETED', entity: 'manager',
      entityId: managerId, entityTitle: existing.Item.username || managerId,
      performedBy: 'masteradmin', meta: { username: existing.Item.username },
    });
    return r(200, { ok: true });
  }

  // ── GET /faq ──────────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/faq') {
    const auth = await requireManagerOrMaster(event);
    const categoryFilter = event.queryStringParameters?.category;
    const res = await ddb.send(new ScanCommand({ TableName: FAQ_TABLE }));
    let items = res.Items || [];
    // Public users only see published articles; authenticated managers see all
    if (!auth.ok) {
      items = items.filter(i => i.status === 'published');
    }
    if (categoryFilter) {
      // Exact case-insensitive match on category field
      const filterLower = categoryFilter.toLowerCase();
      items = items.filter(i => i.category?.toLowerCase() === filterLower);
    }
    return r(200, items);
  }

  // ── POST /faq ─────────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/faq') {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const { title, category, content, status = 'published', id } = body;

    if (id && !title && !content) {
      // Status-only toggle
      if (body.status && !VALID_FAQ_STATUSES.includes(body.status)) return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
      const existing = await ddb.send(new GetCommand({ TableName: FAQ_TABLE, Key: { id } }));
      if (!existing.Item) return r(404, { error: 'Article not found' });
      await ddb.send(new UpdateCommand({
        TableName: FAQ_TABLE,
        Key: { id },
        UpdateExpression: 'SET #s = :s, updatedAt = :t',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':s': body.status || 'published', ':t': new Date().toISOString() },
      }));
      await writeAudit({ action: 'UPDATE_FAQ', entity: 'faq', entityId: id, entityTitle: existing.Item.title, performedBy: auth.performedBy, meta: { newStatus: body.status } });
      return r(200, { ok: true });
    }

    if (!title || !category || !content) return r(400, { error: 'title, category, content required' });
    if (title.length > 300) return r(400, { error: 'title too long (max 300 chars)' });
    if (content.length > 50000) return r(400, { error: 'content too long (max 50000 chars)' });
    if (!VALID_FAQ_STATUSES.includes(status)) return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
    const newId = id || `art-${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();
    await ddb.send(new PutCommand({
      TableName: FAQ_TABLE,
      Item: { id: newId, title, category, content, status, createdAt: now, updatedAt: now },
    }));
    await writeAudit({ action: 'CREATE_FAQ', entity: 'faq', entityId: newId, entityTitle: title, performedBy: auth.performedBy, meta: { category, status } });
    return r(201, { id: newId, ok: true });
  }

  // ── PUT /faq/{id} ─────────────────────────────────────────────────────────
  const faqPutMatch = path.match(/^\/faq\/([^/]+)$/);
  if (method === 'PUT' && faqPutMatch) {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = faqPutMatch[1];
    const { title, category, content, status } = body;

    // Reject empty body PUTs
    if (!title && !category && !content && status === undefined) return r(400, { error: 'Nothing to update' });

    if (status !== undefined && !VALID_FAQ_STATUSES.includes(status)) {
      return r(400, { error: `Invalid status. Allowed: ${VALID_FAQ_STATUSES.join(', ')}` });
    }

    const exprParts = ['updatedAt = :t'];
    const exprNames = {};
    const exprVals = { ':t': new Date().toISOString() };
    if (title) { exprParts.push('title = :ti'); exprVals[':ti'] = title; }
    if (category) { exprParts.push('category = :ca'); exprVals[':ca'] = category; }
    if (content) { exprParts.push('content = :co'); exprVals[':co'] = content; }
    if (status !== undefined) { exprParts.push('#s = :s'); exprNames['#s'] = 'status'; exprVals[':s'] = status; }

    const existing = await ddb.send(new GetCommand({ TableName: FAQ_TABLE, Key: { id } }));
    if (!existing.Item) return r(404, { error: 'Article not found' });
    await ddb.send(new UpdateCommand({
      TableName: FAQ_TABLE,
      Key: { id },
      UpdateExpression: `SET ${exprParts.join(', ')}`,
      ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
      ExpressionAttributeValues: exprVals,
    }));
    await writeAudit({ action: 'UPDATE_FAQ', entity: 'faq', entityId: id, entityTitle: title || existing.Item.title || id, performedBy: auth.performedBy, meta: { fieldsChanged: Object.keys(body) } });
    return r(200, { ok: true });
  }

  // ── DELETE /faq/{id} ──────────────────────────────────────────────────────
  const faqDeleteMatch = path.match(/^\/faq\/([^/]+)$/);
  if (method === 'DELETE' && faqDeleteMatch) {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = faqDeleteMatch[1];
    const existing = await ddb.send(new GetCommand({ TableName: FAQ_TABLE, Key: { id } }));
    if (!existing.Item) return r(404, { error: 'Article not found' });
    const title = existing.Item.title || id;
    // Conditional delete prevents concurrent deletes both succeeding
    try {
      await ddb.send(new DeleteCommand({
        TableName: FAQ_TABLE,
        Key: { id },
        ConditionExpression: 'attribute_exists(id)',
      }));
    } catch (e) {
      if (e.name === 'ConditionalCheckFailedException') return r(404, { error: 'Article not found' });
      throw e;
    }
    await writeAudit({ action: 'DELETE_FAQ', entity: 'faq', entityId: id, entityTitle: title, performedBy: auth.performedBy });
    return r(200, { ok: true });
  }

  // ── GET /tickets ──────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/tickets') {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const res = await ddb.send(new ScanCommand({ TableName: TICKETS_TABLE }));
    const items = (res.Items || []).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
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
    await ddb.send(new PutCommand({
      TableName: TICKETS_TABLE,
      Item: {
        id: ticketId, name: name.trim(), email, category: resolvedCategory,
        subject: subject.trim(), description: description ? String(description).trim() : '',
        phone: phone ? String(phone).trim() : undefined,
        status,
        createdAt: now, date: now.slice(0, 10),
        ipAddress: sourceIp(event),
        userAgent: userAgent(event),
        sessionId: sessionId || 'unknown',
      },
    }));
    await writeAudit({
      action: 'CREATE_TICKET', entity: 'ticket',
      entityId: ticketId, entityTitle: subject,
      performedBy: 'public', meta: { name, email, category: resolvedCategory, ip: sourceIp(event) },
    });
    return r(201, { id: ticketId, ok: true });
  }

  // ── PUT /tickets/{id} ─────────────────────────────────────────────────────
  const ticketPutMatch = path.match(/^\/tickets\/([^/]+)$/);
  if (method === 'PUT' && ticketPutMatch) {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });
    const id = ticketPutMatch[1];

    // Reject empty body PUTs
    if (!body.status && !body.notes && !body.assignedTo) return r(400, { error: 'Nothing to update' });

    const existing = await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { id } }));
    if (!existing.Item) return r(404, { error: 'Ticket not found' });
    const oldStatus = existing.Item.status;
    const newStatus = body.status || oldStatus;
    if (!VALID_TICKET_STATUSES.includes(newStatus)) return r(400, { error: 'Invalid status. Allowed: open, in_progress, solved, resolved' });
    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { id },
      UpdateExpression: 'SET #s = :s, updatedAt = :t',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':s': newStatus, ':t': new Date().toISOString() },
    }));
    await writeAudit({
      action: 'UPDATE_TICKET', entity: 'ticket',
      entityId: id, entityTitle: existing.Item.subject || id,
      performedBy: auth.performedBy,
      meta: { oldStatus, newStatus },
    });
    return r(200, { ok: true });
  }

  // ── GET /audit-log ─────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/audit-log') {
    const auth = await requireManagerOrMaster(event);
    if (!auth.ok) return r(auth.reason === 'deactivated' ? 403 : 401, { error: auth.reason === 'deactivated' ? 'Account deactivated' : 'Unauthorized' });

    let items;
    if (auth.role === 'manager') {
      // Use GSI performedBy-timestamp-index for O(1) manager-scoped lookup
      const res = await ddb.send(new QueryCommand({
        TableName: AUDIT_TABLE,
        IndexName: 'performedBy-timestamp-index',
        KeyConditionExpression: 'performedBy = :p',
        ExpressionAttributeValues: { ':p': auth.performedBy },
        ScanIndexForward: false, // newest first
        Limit: 500,
      }));
      items = res.Items || [];
    } else {
      // Master admin: full scan with a safety cap — fine for operational use
      const res = await ddb.send(new ScanCommand({ TableName: AUDIT_TABLE, Limit: 1000 }));
      items = res.Items || [];
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }

    return r(200, items);
  }

  return r(404, { error: 'Not found' });
}
