'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { API_BASE } from '@/lib/api';

interface SearchResult {
  id: string;
  title: string;
  category: string;
  snippet: string;
  updatedAt?: string;
}

interface Message {
  id: number;
  role: 'bot' | 'user';
  text?: string;
  isStreaming?: boolean;
  results?: SearchResult[];
  query?: string;
  isTyping?: boolean;
  isSkeleton?: boolean;
  noResults?: boolean;
  showTicketCTA?: boolean;
  followUps?: string[];
}

const WELCOME_MESSAGE: Message = {
  id: 0,
  role: 'bot',
  text: "Hi! I'm your Indiabulls Securities assistant. Ask me anything about trading, account opening, funds, charges, or IPOs — I'll find the right article for you instantly.",
};

const POPULAR_TOPICS = [
  { label: 'Open an account',   q: 'open account' },
  { label: 'Add funds',         q: 'how to add funds' },
  { label: 'Apply for IPO',     q: 'apply for IPO' },
  { label: 'GTT order',         q: 'GTT order' },
  { label: 'Brokerage charges', q: 'brokerage charges' },
  { label: 'F&O segment',       q: 'F&O activation' },
];

const ZERO_RESULT_HINTS = [
  'How to open an account',
  'Add funds to my account',
  'Apply for IPO',
  'Brokerage charges',
];

const PLACEHOLDER_EXAMPLES = [
  'Ask anything...',
  'e.g. How do I add funds?',
  'e.g. What are brokerage charges?',
  'e.g. How to apply for IPO?',
  'e.g. How to activate F&O?',
];

function followUpForCategory(category: string): string | null {
  const map: Record<string, string> = {
    'Account Opening':     'How long does account opening take',
    'Trading':             'How to place a market order',
    'Funds':               'How long does withdrawal take',
    'Charges & Brokerage': 'What are AMC charges',
    'Mutual Funds':        'How to start a SIP',
    'IPO':                 'IPO allotment process',
    'F&O':                 'How to activate F&O segment',
    'Reports':             'How to download contract notes',
    'MTF':                 'What is MTF interest rate',
    'Pledging':            'How does pledging work',
  };
  return map[category] || null;
}

const SESSION_KEY = 'ib_chatbot_messages';
let msgIdCounter = 100;
const nextId = () => ++msgIdCounter;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    if (!query || !text) return [{ text, isMatch: false }];
    const words = query.trim().toLowerCase().split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) return [{ text, isMatch: false }];
    const sorted = [...new Set(words)].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(${sorted.map(escapeRegex).join('|')})`, 'gi');
    const segments: { text: string; isMatch: boolean }[] = [];
    let lastIdx = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIdx) segments.push({ text: text.slice(lastIdx, match.index), isMatch: false });
      segments.push({ text: match[0], isMatch: true });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) segments.push({ text: text.slice(lastIdx), isMatch: false });
    return segments;
  }, [text, query]);

  return (
    <>
      {parts.map((p, i) =>
        p.isMatch
          ? <mark key={i} style={{ background: 'rgba(0,171,78,0.14)', color: 'inherit', borderRadius: 2, padding: '0 1px', fontWeight: 600 }}>{p.text}</mark>
          : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

function loadSession(): Message[] {
  if (typeof window === 'undefined') return [WELCOME_MESSAGE];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as Message[];
    // Strip in-progress states that shouldn't survive a reload
    return parsed.map(m => ({ ...m, isStreaming: false, isSkeleton: false, isTyping: false }));
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function saveSession(messages: Message[]) {
  try {
    // Don't persist skeleton/streaming states
    const clean = messages.filter(m => !m.isSkeleton);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(clean));
  } catch { /* quota exceeded — ignore */ }
}

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ib_chatbot_seen') === '1';
  });
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputVal, setInputVal] = useState('');
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session on first mount
  useEffect(() => {
    setMessages(loadSession());
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    saveSession(messages);
  }, [messages]);

  // Auto-scroll on message update
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-focus input when chat opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Rotate placeholder text every 3 seconds when input is empty and idle
  useEffect(() => {
    if (open && !inputVal && !searching) {
      const t = setInterval(() => {
        setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_EXAMPLES.length);
      }, 3000);
      return () => clearInterval(t);
    }
  }, [open, inputVal, searching]);

  const addMessage = useCallback((msg: Omit<Message, 'id'>) => {
    const id = nextId();
    setMessages(prev => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const streamTextIntoMessage = useCallback((
    messageId: number,
    fullText: string,
    charsPerTick = 1,
    tickMs = 26
  ): Promise<void> => {
    return new Promise(resolve => {
      let i = 0;
      const interval = setInterval(() => {
        // Natural rhythm: slightly vary speed at word boundaries
        const step = fullText[i] === ' ' ? 1 : charsPerTick;
        i = Math.min(i + step, fullText.length);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, text: fullText.slice(0, i), isStreaming: i < fullText.length } : m
          )
        );
        if (i >= fullText.length) { clearInterval(interval); resolve(); }
      }, tickMs);
    });
  }, []);

  // Build a contextual, natural intro that echoes the user's query intent.
  // Never says "popular topic" — that was a false signal on any 5-result query.
  const buildIntro = useCallback((trimmed: string, count: number, topCategory: string): string => {
    // Detect if the query was a chip click (short, clean label) vs free-form typing
    const isShortChip = trimmed.split(' ').length <= 4 && trimmed.length <= 30;
    const topic = trimmed.length <= 40
      ? `"${trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()}"`
      : null;

    if (count === 1) {
      return topic
        ? `Here's the most relevant article for ${topic}:`
        : "Here's the most relevant article I found:";
    }

    // Category-aware intro when all results share one category
    const categoryIntros: Record<string, string> = {
      'IPO':               `Here are ${count} articles on IPO:`,
      'Account Opening':   `Here are ${count} articles on account opening:`,
      'Funds':             `Here are ${count} articles on funds & payments:`,
      'Trading':           `Here are ${count} articles on trading:`,
      'Charges & Brokerage': `Here are ${count} articles on charges:`,
      'F&O':               `Here are ${count} articles on F&O:`,
      'Mutual Funds':      `Here are ${count} articles on mutual funds:`,
      'MTF':               `Here are ${count} articles on margin trading:`,
      'NRI/HUF Accounts':  `Here are ${count} articles on NRI/HUF accounts:`,
    };

    if (isShortChip && categoryIntros[topCategory]) {
      return categoryIntros[topCategory];
    }

    // Free-form query — echo the topic back naturally
    if (topic && count <= 3) return `Found ${count} articles for ${topic}:`;
    if (topic) return `Here's what I found for ${topic}:`;
    return count === 1 ? "Here's the most relevant article:" : `Here are ${count} articles that should help:`;
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !API_BASE || searching) return;
    if (trimmed.length < 2) {
      addMessage({ role: 'bot', text: 'Please type at least 2 characters to search.' });
      return;
    }
    // Prevent re-searching identical consecutive query
    if (trimmed.toLowerCase() === lastQuery.toLowerCase()) return;

    setLastQuery(trimmed);
    addMessage({ role: 'user', text: trimmed });

    // 300ms typing dots — makes the bot feel alive before skeleton appears
    const typingId = addMessage({ role: 'bot', isTyping: true });
    setSearching(true);
    trackEvent({ eventType: 'chatbot_message', chatInput: trimmed.slice(0, 200) });
    await new Promise(r => setTimeout(r, 320));
    setMessages(prev => prev.filter(m => m.id !== typingId));
    const skeletonId = addMessage({ role: 'bot', isSkeleton: true });

    try {
      const res = await fetch(`${API_BASE}/faq/search?q=${encodeURIComponent(trimmed)}&limit=5`);
      const data = await res.json();
      setMessages(prev => prev.filter(m => m.id !== skeletonId));

      if (data.results && data.results.length > 0) {
        const count = data.results.length;
        const topCategory = data.results[0]?.category || '';
        const introText = buildIntro(trimmed, count, topCategory);

        const followUps = Array.from(
          new Set(
            data.results
              .map((r: SearchResult) => followUpForCategory(r.category))
              .filter((s: string | null): s is string => Boolean(s))
          )
        ).slice(0, 3) as string[];

        const botMsgId = addMessage({
          role: 'bot',
          text: '',
          isStreaming: true,
          results: data.results,
          query: trimmed,
          followUps,
        });
        // Short intros (≤ 60 chars) stream at 3 chars/tick — feels snappy like ChatGPT.
        // Longer texts use the default 1 char/tick for readability.
        const speed = introText.length <= 60 ? 3 : 1;
        await streamTextIntoMessage(botMsgId, introText, speed);
        trackEvent({ eventType: 'search', searchTerm: trimmed.slice(0, 200), searchResultCount: count });
      } else {
        const botMsgId = addMessage({
          role: 'bot',
          text: '',
          isStreaming: true,
          noResults: true,
          showTicketCTA: true,
          query: trimmed,
        });
        await streamTextIntoMessage(botMsgId, `I couldn't find anything for "${trimmed}". Try one of these or raise a support ticket:`);
        trackEvent({ eventType: 'search', searchTerm: trimmed.slice(0, 200), searchResultCount: 0 });
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== skeletonId));
      addMessage({ role: 'bot', text: 'Something went wrong. Please try again or browse the Knowledge Base.' });
    } finally {
      setSearching(false);
    }
  }, [searching, lastQuery, addMessage, streamTextIntoMessage, buildIntro]);

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text || searching) return;
    setInputVal('');
    runSearch(text);
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setLastQuery('');
    sessionStorage.removeItem(SESSION_KEY);
    inputRef.current?.focus();
  };

  const handleCopyLink = (r: SearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/faq/?q=${encodeURIComponent(r.title)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(r.id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  const isInitial = messages.length === 1 && messages[0].id === WELCOME_MESSAGE.id;

  return (
    <div className="chatbot-container">
      {/* Floating bubble */}
      <button
        className={`chatbot-bubble${open ? ' chat-open' : ''}`}
        onClick={() => {
          const opening = !open;
          setOpen(o => !o);
          if (opening) {
            setHasSeen(true);
            localStorage.setItem('ib_chatbot_seen', '1');
            trackEvent({ eventType: 'chatbot_open' });
          }
        }}
        aria-label="Open support chat"
      >
        <i className="fas fa-comment-dots"></i>
        {!hasSeen && <span className="bubble-ping"></span>}
      </button>

      {/* Chat window */}
      <div className={`chat-window${open ? ' active' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="header-info">
            <div className="bot-avatar" style={{ background: '#fff', padding: 4 }}>
              <img src="/logo.svg" alt="Indiabulls" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h4>Indiabulls Securities Assistant</h4>
              <span className="online-status">Online · Avg. reply instant</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {!isInitial && (
              <button
                onClick={handleClearChat}
                aria-label="Clear conversation"
                title="Start a new conversation"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.85rem',
                  padding: '0.25rem 0.4rem',
                  borderRadius: 4,
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              >
                <i className="fas fa-rotate-left"></i>
              </button>
            )}
            <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Messages body */}
        <div className="chat-body" ref={bodyRef}>
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.isSkeleton ? (
                <div style={{ marginLeft: '2.5rem', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="chatbot-skeleton-card" style={{ padding: '0.65rem 0.85rem' }}>
                      <div className="chatbot-skeleton-line" style={{ width: '30%', height: 8, marginBottom: 8, borderRadius: 3 }}></div>
                      <div className="chatbot-skeleton-line" style={{ width: '85%', height: 12, marginBottom: 6, borderRadius: 3 }}></div>
                      <div className="chatbot-skeleton-line" style={{ width: '65%', height: 10, borderRadius: 3 }}></div>
                    </div>
                  ))}
                </div>
              ) : msg.isTyping ? (
                <div className="message bot typing">
                  <div className="msg-content">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`message ${msg.role}`}>
                    <div className="msg-content">
                      {msg.text}
                      {msg.isStreaming && <span className="streaming-cursor" aria-hidden="true">▎</span>}
                    </div>
                  </div>

                  {/* Article result cards — only render after streaming so cards animate in cleanly */}
                  {msg.results && msg.results.length > 0 && !msg.isStreaming && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0', marginLeft: '2.5rem' }}>
                        {msg.results.map((r, idx) => (
                          <div
                            key={r.id}
                            className="chatbot-result-card"
                            style={{ position: 'relative', animation: `chatbotCardFadeIn 0.35s ease both`, animationDelay: `${idx * 60}ms` }}
                          >
                            <Link
                              href={`/faq/?q=${encodeURIComponent(r.title)}`}
                              className="chatbot-result-link"
                              onClick={() => trackEvent({ eventType: 'article_view', articleId: r.id, articleTitle: r.title, category: r.category })}
                            >
                              <div className="chatbot-result-category">{r.category}</div>
                              <div className="chatbot-result-title">
                                <HighlightedText text={r.title} query={msg.query || ''} />
                              </div>
                              {r.snippet && (
                                <div className="chatbot-result-snippet">
                                  <HighlightedText text={r.snippet} query={msg.query || ''} />
                                </div>
                              )}
                            </Link>
                            <button
                              onClick={(e) => handleCopyLink(r, e)}
                              aria-label="Copy article link"
                              title={copiedId === r.id ? 'Copied!' : 'Copy link'}
                              style={{
                                position: 'absolute', top: 8, right: 8,
                                width: 28, height: 28,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: copiedId === r.id ? '#00AB4E' : 'transparent',
                                color: copiedId === r.id ? 'white' : 'var(--text-muted, #6B7280)',
                                border: 'none', borderRadius: 6, cursor: 'pointer',
                                fontSize: '0.75rem', transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { if (copiedId !== r.id) { e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; e.currentTarget.style.color = '#00AB4E'; } }}
                              onMouseLeave={e => { if (copiedId !== r.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted, #6B7280)'; } }}
                            >
                              <i className={`fas ${copiedId === r.id ? 'fa-check' : 'fa-link'}`}></i>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* See all results in FAQ — only meaningful when there are multiple results */}
                      {msg.results.length > 1 && <div style={{
                        marginLeft: '2.5rem',
                        marginTop: '0.25rem',
                        animation: `chatbotCardFadeIn 0.35s ease both`,
                        animationDelay: `${msg.results.length * 60 + 50}ms`,
                      }}>
                        <Link
                          href={`/faq/?q=${encodeURIComponent(msg.query || '')}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.8rem',
                            color: '#00AB4E',
                            fontWeight: 600,
                            textDecoration: 'none',
                            padding: '0.4rem 0.85rem',
                            border: '1.5px solid rgba(0,171,78,0.3)',
                            borderRadius: 99,
                            background: 'rgba(0,171,78,0.04)',
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,171,78,0.1)'; e.currentTarget.style.borderColor = '#00AB4E'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,171,78,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,171,78,0.3)'; }}
                        >
                          See all results in Knowledge Base
                          <i className="fas fa-arrow-right" style={{ fontSize: '0.7rem' }}></i>
                        </Link>
                      </div>}
                    </>
                  )}

                  {/* Follow-up suggestion chips */}
                  {msg.followUps && msg.followUps.length > 0 && !msg.isStreaming && (
                    <div style={{
                      marginLeft: '2.5rem', marginTop: '0.5rem',
                      animation: 'chatbotCardFadeIn 0.35s ease both',
                      animationDelay: `${(msg.results?.length || 0) * 60 + 120}ms`,
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                        You might also ask
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {msg.followUps.map(fu => (
                          <button key={fu} className="action-chip" onClick={() => runSearch(fu)} disabled={searching}>{fu}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty-state actions */}
                  {msg.showTicketCTA && !msg.isStreaming && (
                    <div style={{ marginLeft: '2.5rem', marginTop: '0.5rem', animation: 'chatbotCardFadeIn 0.35s ease both' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                        Try one of these
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {ZERO_RESULT_HINTS.map(h => (
                          <button key={h} className="action-chip" onClick={() => runSearch(h)} disabled={searching}>{h}</button>
                        ))}
                      </div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 0' }} />
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link
                          href={`/contact/?subject=${encodeURIComponent(lastQuery)}`}
                          className="action-chip"
                          style={{ background: '#00AB4E', color: 'white', borderColor: '#00AB4E' }}
                          onClick={() => trackEvent({ eventType: 'ticket_submit', ticketCategory: 'chatbot_fallback', chatInput: lastQuery.slice(0, 200) })}
                        >
                          <i className="fas fa-headset" style={{ marginRight: '0.4rem' }}></i>
                          Create a ticket
                        </Link>
                        <Link href="/faq/" className="action-chip">
                          <i className="fas fa-book" style={{ marginRight: '0.4rem' }}></i>
                          Browse Knowledge Base
                        </Link>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Popular topics — shown on fresh chat OR as "explore more" after a conversation */}
          {isInitial ? (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                Popular topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {POPULAR_TOPICS.map(t => (
                  <button key={t.q} className="action-chip" onClick={() => runSearch(t.q)} disabled={searching}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : !searching && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                Explore other topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {POPULAR_TOPICS.map(t => (
                  <button key={t.q} className="action-chip" onClick={() => runSearch(t.q)} disabled={searching} style={{ fontSize: '0.72rem' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input footer */}
        <div className="chat-footer">
          <div className="chat-footer-inner">
            <input
              ref={inputRef}
              type="text"
              placeholder={PLACEHOLDER_EXAMPLES[placeholderIdx]}
              autoComplete="off"
              value={inputVal}
              maxLength={300}
              disabled={searching}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={searching || !inputVal.trim()}
              aria-label="Send message"
            >
              {searching
                ? <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.8rem' }}></i>
                : <i className="fas fa-paper-plane" style={{ fontSize: '0.8rem' }}></i>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
