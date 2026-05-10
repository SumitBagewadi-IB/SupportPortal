'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function getSessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'ssr';
  let sid = sessionStorage.getItem('ib_session');
  if (!sid) {
    sid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('ib_session', sid);
  }
  return sid;
}

export interface AnalyticsEvent {
  eventType:
    | 'article_view'
    | 'search'
    | 'chatbot_open'
    | 'chatbot_persona_select'
    | 'chatbot_message'
    | 'ticket_submit'
    | 'faq_feedback'
    | 'admin_login_fail';
  articleId?: string;
  articleTitle?: string;
  category?: string;
  searchTerm?: string;
  searchResultCount?: number;
  feedbackType?: 'helpful' | 'not_helpful';
  persona?: string;
  chatInput?: string;
  ticketCategory?: string;
}

export function trackEvent(payload: AnalyticsEvent): void {
  if (!API_BASE || typeof window === 'undefined') return;
  try {
    const sessionId = getSessionId();
    const body = JSON.stringify({ ...payload, sessionId });
    // Always use fetch — sendBeacon with application/json Blob triggers CORS preflight
    // which API Gateway may reject. keepalive:true preserves fire-and-forget behaviour.
    fetch(`${API_BASE}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch { /* fire-and-forget, never throw */ }
}

export function getSession(): string {
  if (typeof window === 'undefined') return '';
  return getSessionId();
}
