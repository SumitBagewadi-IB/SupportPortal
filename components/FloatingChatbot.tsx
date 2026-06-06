'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
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
  query?: string;              // The query that produced these results — used for highlighting
  isTyping?: boolean;
  isSkeleton?: boolean;        // Show skeleton card placeholders while searching
  noResults?: boolean;
  showTicketCTA?: boolean;
  followUps?: string[];        // Suggested follow-up queries based on top categories
}

const POPULAR_TOPICS = [
  { label: 'Open an account',      q: 'open account' },
  { label: 'Add funds',            q: 'how to add funds' },
  { label: 'Apply for IPO',        q: 'apply for IPO' },
  { label: 'GTT order',            q: 'GTT order' },
  { label: 'Brokerage charges',    q: 'brokerage charges' },
  { label: 'F&O segment',          q: 'F&O activation' },
];

// Suggested follow-up queries when search returns 0 results
const ZERO_RESULT_HINTS = [
  'How to open an account',
  'Add funds to my account',
  'Apply for IPO',
  'Brokerage charges',
];

// Map a category name → a suggested follow-up query
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

let msgIdCounter = 0;
const nextId = () => ++msgIdCounter;

// Escape special regex characters in a string
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Highlight all occurrences of the query words within text using <mark>.
// Splits the query into words, matches each one case-insensitively.
function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    if (!query || !text) return [{ text, isMatch: false }];
    const words = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 2);
    if (words.length === 0) return [{ text, isMatch: false }];

    // Build a single regex matching any of the words (longest first to avoid sub-matches)
    const sorted = [...new Set(words)].sort((a, b) => b.length - a.length);
    const re = new RegExp(`(${sorted.map(escapeRegex).join('|')})`, 'gi');

    const segments: { text: string; isMatch: boolean }[] = [];
    let lastIdx = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segments.push({ text: text.slice(lastIdx, match.index), isMatch: false });
      }
      segments.push({ text: match[0], isMatch: true });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      segments.push({ text: text.slice(lastIdx), isMatch: false });
    }
    return segments;
  }, [text, query]);

  return (
    <>
      {parts.map((p, i) =>
        p.isMatch ? (
          <mark
            key={i}
            style={{
              background: 'rgba(0,171,78,0.18)',
              color: 'inherit',
              padding: '0 2px',
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: nextId(), role: 'bot', text: "Hi! I'm your Indiabulls Securities assistant. Ask me anything about your account, trading, funds, or charges." },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [searching, setSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Smooth auto-scroll on any message update (including during streaming)
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const addMessage = (msg: Omit<Message, 'id'>) => {
    const id = nextId();
    setMessages(prev => [...prev, { ...msg, id }]);
    return id;
  };

  const streamTextIntoMessage = (
    messageId: number,
    fullText: string,
    charsPerTick = 2,
    tickMs = 25
  ): Promise<void> => {
    return new Promise(resolve => {
      let i = 0;
      const interval = setInterval(() => {
        i = Math.min(i + charsPerTick, fullText.length);
        setMessages(prev =>
          prev.map(m =>
            m.id === messageId ? { ...m, text: fullText.slice(0, i), isStreaming: i < fullText.length } : m
          )
        );
        if (i >= fullText.length) {
          clearInterval(interval);
          resolve();
        }
      }, tickMs);
    });
  };

  const runSearch = async (q: string) => {
    if (!q.trim() || !API_BASE || searching) return;
    setLastQuery(q);
    addMessage({ role: 'user', text: q });

    // Show skeleton placeholder cards while fetching (replaces dot-typing for results)
    const skeletonId = addMessage({ role: 'bot', isSkeleton: true });
    setSearching(true);
    trackEvent({ eventType: 'chatbot_message', chatInput: q.slice(0, 200) });

    try {
      const res = await fetch(`${API_BASE}/faq/search?q=${encodeURIComponent(q)}&limit=5`);
      const data = await res.json();
      // Remove skeleton
      setMessages(prev => prev.filter(m => m.id !== skeletonId));

      if (data.results && data.results.length > 0) {
        const count = data.results.length;
        const introText =
          count === 1
            ? "Here's what I found:"
            : count >= 5
            ? "This is a popular topic — here are the most relevant articles:"
            : `I found ${count} articles that should help:`;

        // Build follow-ups from top categories (dedupe, max 3)
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
          query: q,
          followUps,
        });
        await streamTextIntoMessage(botMsgId, introText);

        trackEvent({ eventType: 'search', searchTerm: q.slice(0, 200), searchResultCount: count });
      } else {
        const introText = "I couldn't find an article matching that. Try one of these instead, or create a support ticket:";
        const botMsgId = addMessage({
          role: 'bot',
          text: '',
          isStreaming: true,
          noResults: true,
          showTicketCTA: true,
          query: q,
        });
        await streamTextIntoMessage(botMsgId, introText);
        trackEvent({ eventType: 'search', searchTerm: q.slice(0, 200), searchResultCount: 0 });
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== skeletonId));
      addMessage({
        role: 'bot',
        text: 'Sorry, something went wrong. Please try again or browse our Knowledge Base directly.',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSend = () => {
    const text = inputVal.trim();
    if (!text || searching) return;
    setInputVal('');
    runSearch(text);
  };

  const handleTopicClick = (q: string) => {
    if (searching) return;
    runSearch(q);
  };

  const handleResultClick = (r: SearchResult) => {
    trackEvent({
      eventType: 'article_view',
      articleId: r.id,
      articleTitle: r.title,
      category: r.category,
    });
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

  return (
    <div className="chatbot-container">
      {/* Floating bubble */}
      <button
        className="chatbot-bubble"
        onClick={() => {
          const opening = !open;
          setOpen(o => !o);
          if (opening) trackEvent({ eventType: 'chatbot_open' });
        }}
        aria-label="Open support chat"
      >
        <i className="fas fa-comment-dots"></i>
        <span className="bubble-ping"></span>
      </button>

      {/* Chat window */}
      <div className={`chat-window${open ? ' active' : ''}`}>
        {/* Header */}
        <div className="chat-header">
          <div className="header-info">
            <div className="bot-avatar" style={{ background: '#00AB4E' }}>
              <i className="fas fa-robot"></i>
            </div>
            <div>
              <h4>Indiabulls Securities Assistant</h4>
              <span className="online-status">Online · Avg. reply instant</span>
            </div>
          </div>
          <button className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Messages body */}
        <div className="chat-body" ref={bodyRef}>
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.isSkeleton ? (
                <div style={{ marginLeft: '2.5rem', padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="chatbot-skeleton-card"
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-subtle, #F9FAFB)',
                        border: '1px solid var(--border, #E5E7EB)',
                        borderRadius: '0.5rem',
                      }}
                    >
                      <div className="chatbot-skeleton-line" style={{ width: '30%', height: 8, marginBottom: 8, borderRadius: 3 }}></div>
                      <div className="chatbot-skeleton-line" style={{ width: '85%', height: 12, marginBottom: 6, borderRadius: 3 }}></div>
                      <div className="chatbot-skeleton-line" style={{ width: '70%', height: 10, borderRadius: 3 }}></div>
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

                  {/* Article result cards — appear after streaming completes */}
                  {msg.results && msg.results.length > 0 && !msg.isStreaming && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem 0', marginLeft: '2.5rem' }}>
                      {msg.results.map((r, idx) => (
                        <div
                          key={r.id}
                          className="chatbot-result-card"
                          style={{
                            position: 'relative',
                            animation: `chatbotCardFadeIn 0.35s ease both`,
                            animationDelay: `${idx * 60}ms`,
                          }}
                        >
                          <Link
                            href={`/faq/?q=${encodeURIComponent(r.title)}`}
                            onClick={() => handleResultClick(r)}
                            style={{
                              display: 'block',
                              padding: '0.65rem 0.85rem',
                              paddingRight: '2.5rem',
                              background: 'var(--bg-subtle, #F9FAFB)',
                              border: '1px solid var(--border, #E5E7EB)',
                              borderRadius: '0.5rem',
                              textDecoration: 'none',
                              color: 'inherit',
                              transition: 'border-color 0.2s, background 0.2s, transform 0.2s, box-shadow 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#00AB4E';
                              e.currentTarget.style.background = 'rgba(0,171,78,0.04)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,171,78,0.08)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '';
                              e.currentTarget.style.background = '';
                              e.currentTarget.style.transform = '';
                              e.currentTarget.style.boxShadow = '';
                            }}
                          >
                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00AB4E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                              {r.category}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, marginBottom: '0.2rem', color: 'var(--text, #111827)' }}>
                              <HighlightedText text={r.title} query={msg.query || ''} />
                            </div>
                            {r.snippet && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6B7280)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                <HighlightedText text={r.snippet} query={msg.query || ''} />
                              </div>
                            )}
                          </Link>

                          {/* Copy link button */}
                          <button
                            onClick={(e) => handleCopyLink(r, e)}
                            aria-label="Copy article link"
                            title={copiedId === r.id ? 'Copied!' : 'Copy link'}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 28,
                              height: 28,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: copiedId === r.id ? '#00AB4E' : 'transparent',
                              color: copiedId === r.id ? 'white' : 'var(--text-muted, #6B7280)',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (copiedId !== r.id) {
                                e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                                e.currentTarget.style.color = '#00AB4E';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (copiedId !== r.id) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-muted, #6B7280)';
                              }
                            }}
                          >
                            <i className={`fas ${copiedId === r.id ? 'fa-check' : 'fa-link'}`}></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Follow-up suggestion chips — after results */}
                  {msg.followUps && msg.followUps.length > 0 && !msg.isStreaming && (
                    <div style={{
                      marginLeft: '2.5rem',
                      marginTop: '0.5rem',
                      animation: 'chatbotCardFadeIn 0.35s ease both',
                      animationDelay: `${(msg.results?.length || 0) * 60 + 100}ms`,
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                        You might also ask
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {msg.followUps.map((fu) => (
                          <button
                            key={fu}
                            className="action-chip"
                            onClick={() => handleTopicClick(fu)}
                            disabled={searching}
                          >
                            {fu}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty-state actions */}
                  {msg.showTicketCTA && !msg.isStreaming && (
                    <div style={{ marginLeft: '2.5rem', marginTop: '0.5rem', animation: 'chatbotCardFadeIn 0.35s ease both' }}>
                      {/* Suggested searches when no result */}
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                        Try one of these
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                        {ZERO_RESULT_HINTS.map(h => (
                          <button
                            key={h}
                            className="action-chip"
                            onClick={() => handleTopicClick(h)}
                            disabled={searching}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Link
                          href={`/contact/?subject=${encodeURIComponent(lastQuery)}`}
                          className="action-chip"
                          style={{ background: '#00AB4E', color: 'white', borderColor: '#00AB4E' }}
                          onClick={() =>
                            trackEvent({
                              eventType: 'ticket_submit',
                              ticketCategory: 'chatbot_fallback',
                              chatInput: lastQuery.slice(0, 200),
                            })
                          }
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

          {/* Popular topics — shown when chat is fresh */}
          {messages.length === 1 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted, #6B7280)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                Popular topics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {POPULAR_TOPICS.map((t) => (
                  <button
                    key={t.q}
                    className="action-chip"
                    onClick={() => handleTopicClick(t.q)}
                    disabled={searching}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input footer */}
        <div className="chat-footer">
          <input
            type="text"
            placeholder="Ask anything..."
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
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
