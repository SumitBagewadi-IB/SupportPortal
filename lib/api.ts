/**
 * Single source of truth for the API base URL and common request helpers.
 *
 * NEXT_PUBLIC_API_BASE is set at build time (see .github/workflows/deploy.yml
 * and the Next.js build). All pages and components should import API_BASE
 * from here instead of reading process.env directly — this gives us one
 * place to swap in a different transport (proxy, edge function, etc.) later.
 */

export const API_BASE: string = process.env.NEXT_PUBLIC_API_BASE || '';

/**
 * Build headers for a manager-authenticated request (JWT in Authorization).
 * Pass the manager JWT obtained from POST /auth/login.
 */
export function authHeaders(managerToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${managerToken}`,
  };
}

/**
 * Read the master session token from sessionStorage.
 * Returns '' if not in browser context or token not set.
 *
 * Master token is obtained via POST /auth/masterlogin (server-validated
 * against MASTER_ADMIN_SECRET; the raw password is never in the browser).
 */
export function getMasterToken(): string {
  if (typeof sessionStorage === 'undefined') return '';
  return sessionStorage.getItem('master_token') || '';
}

/**
 * Standard JSON headers for master-authenticated requests. The master
 * token is passed as a query string parameter (?_mt=…) via masterUrl(),
 * not as a header — this keeps the API surface symmetric with curl usage.
 */
export function getMasterHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

/**
 * Build a fully-qualified API URL with the master session token attached
 * as a `_mt` query parameter. Returns the URL unchanged if no token is set.
 *
 * @example
 *   await fetch(masterUrl('/managers'), { headers: getMasterHeaders() });
 */
export function masterUrl(path: string): string {
  const token = getMasterToken();
  if (!token) return `${API_BASE}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${sep}_mt=${encodeURIComponent(token)}`;
}
