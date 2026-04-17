'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const CATEGORIES = [
  'Getting Started', 'Account Opening', 'Trading', 'Portfolio & Margin',
  'Funds', 'Charges & Brokerage', 'Compliance & Safety', 'Mutual Funds',
  'IPO', 'F&O', 'Pledging', 'MTF', 'Tender Offers', 'Contact & Help',
  'Advanced', 'Account', 'Reports', 'NRI/HUF Accounts', 'Other',
];

const ARTICLE_SUGGESTIONS: Record<string, string[]> = {
  gtt: ['How to place a GTT order?', 'GTT order not triggering'],
  fund: ['How to add funds?', 'Fund withdrawal process', 'Fund transfer failed'],
  margin: ['What is margin requirement?', 'How to increase margin?'],
  password: ['How to reset password?', 'Forgot client ID'],
  brokerage: ['Brokerage charges for equity', 'F&O brokerage details'],
  tpin: ['What is TPIN?', 'How to generate TPIN?', 'TPIN not working'],
  sip: ['How to start a SIP?', 'SIP modification process'],
  ipo: ['How to apply for IPO?', 'IPO allotment status'],
};

function getSuggestions(subject: string): string[] {
  const lower = subject.toLowerCase();
  for (const [key, suggestions] of Object.entries(ARTICLE_SUGGESTIONS)) {
    if (lower.includes(key)) return suggestions;
  }
  return [];
}

function generateTicketId(): string {
  return `TIC-${Math.floor(10000 + Math.random() * 90000)}`;
}

interface Ticket {
  id: string; name: string; email: string; category: string;
  subject: string; description: string;
  status: 'open' | 'in_progress' | 'solved'; createdAt: string;
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.625rem 1rem', border: `1.5px solid ${hasError ? '#FC8181' : 'var(--border)'}`,
  borderRadius: 10, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  background: 'var(--bg)', color: 'var(--text-dark)', fontFamily: 'inherit',
});

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: 'var(--text-mid)', marginBottom: '0.375rem',
};

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', category: '', subject: '', description: '' });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { setSuggestions(getSuggestions(form.subject)); }, [form.subject]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!form.category) e.category = 'Please select a category';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.description.trim()) e.description = 'Description is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const id = generateTicketId();
    const ticket: Ticket = { id, ...form, status: 'open', createdAt: new Date().toISOString() };
    try {
      const existing: Ticket[] = JSON.parse(localStorage.getItem('is_tickets') || '[]');
      existing.unshift(ticket);
      localStorage.setItem('is_tickets', JSON.stringify(existing));
    } catch { /* ignore */ }
    if (API_BASE) {
      fetch(`${API_BASE}/tickets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ticket) }).catch(() => {});
    }
    setTicketId(id);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="page-wrap">
        <div className="container" style={{ maxWidth: 520, textAlign: 'center', paddingTop: '5rem', paddingBottom: '5rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E6FAE6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <i className="fas fa-check" style={{ color: '#00C805', fontSize: '1.5rem' }}></i>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>Ticket Submitted!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            Your ticket <strong style={{ color: '#00C805' }}>{ticketId}</strong> has been created.
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>We&apos;ll get back to you within 24 hours.</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/my-tickets" className="btn-primary">View My Tickets</Link>
            <button
              onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: '', subject: '', description: '' }); }}
              style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-mid)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
            >Submit Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="container">
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '1rem' }}>Submit a Ticket</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: 1.5 }}>
            Our support team typically responds within <strong style={{ color: 'var(--text-dark)' }}>2–4 business hours</strong>. Describe your issue and we&apos;ll help you get back to trading.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="form-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label style={labelStyle}>Full Name <span style={{ color: '#E53E3E' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <i className="fas fa-user" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" style={{ ...inputStyle(!!errors.name), paddingLeft: '2.5rem' }} />
              </div>
              {errors.name && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#E53E3E' }}>{errors.name}</p>}
            </div>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label style={labelStyle}>Email Address <span style={{ color: '#E53E3E' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <i className="fas fa-envelope" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" style={{ ...inputStyle(!!errors.email), paddingLeft: '2.5rem' }} />
              </div>
              {errors.email && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#E53E3E' }}>{errors.email}</p>}
            </div>
          </div>

          <div className="form-field">
            <label style={labelStyle}>Issue Category <span style={{ color: '#E53E3E' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-list" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle(!!errors.category), paddingLeft: '2.5rem' }}>
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {errors.category && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#E53E3E' }}>{errors.category}</p>}
          </div>

          <div className="form-field">
            <label style={labelStyle}>Subject <span style={{ color: '#E53E3E' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-pen" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
              <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief summary of your issue" style={{ ...inputStyle(!!errors.subject), paddingLeft: '2.5rem' }} />
            </div>
            {errors.subject && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#E53E3E' }}>{errors.subject}</p>}
            {suggestions.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.875rem 1rem', background: '#F0FFF4', border: '1px solid #9AE6B4', borderRadius: 8 }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#276749', marginBottom: '0.5rem' }}>
                  <i className="fas fa-lightbulb" style={{ marginRight: '0.375rem' }}></i>Recommended Articles
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <Link href="/faq" style={{ fontSize: '0.8125rem', color: '#276749', textDecoration: 'none' }}>→ {s}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="form-field">
            <label style={labelStyle}>Detailed Description <span style={{ color: '#E53E3E' }}>*</span></label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} placeholder="Please provide as much detail as possible (Order ID, Ticker, etc.)" style={{ ...inputStyle(!!errors.description), resize: 'vertical', minHeight: 120 }} />
            {errors.description && <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#E53E3E' }}>{errors.description}</p>}
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem', marginTop: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <i className="fas fa-paper-plane" style={{ fontSize: '0.9rem' }}></i> Send Message
          </button>
          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <i className="fas fa-shield-alt" style={{ marginRight: 4 }}></i> Secure SSL Encrypted Submission
          </p>
        </form>

        {/* More Ways to Connect */}
        <div style={{ marginTop: '5rem', paddingTop: '3rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>More Ways to Connect</h2>
            <p style={{ color: 'var(--text-muted)' }}>Prefer direct communication? Reach out through these channels.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {[
              { icon: 'fas fa-phone-volume', bg: '#EFF6FF', color: '#3B82F6', title: 'Call Support', desc: 'Immediate assistance for trading & account queries.', detail: <a href="tel:02261446300" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)', textDecoration: 'none' }}>022-61446300</a>, sub: 'Mon – Sat, 8 AM – 8 PM' },
              { icon: 'fas fa-envelope-open-text', bg: '#F0FDF4', color: '#22C55E', title: 'Email Us', desc: 'For detailed queries, documentation or feedback.', detail: <a href="mailto:helpdesk@indiabullssecurities.com" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3B82F6', textDecoration: 'none' }}>helpdesk@indiabullssecurities.com</a>, sub: 'Average Response: 4 hrs' },
              { icon: 'fas fa-location-dot', bg: '#FFF1F2', color: '#F43F5E', title: 'Registered Office', desc: 'Plot no. 108, 5th Floor, IT Park,\nUdyog Vihar, Phase - I,\nGurugram – 122016, Haryana', detail: null, sub: null },
            ].map((card) => (
              <div key={card.title} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, background: card.bg, color: card.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '1.5rem' }}>
                  <i className={card.icon}></i>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>{card.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', whiteSpace: 'pre-line' }}>{card.desc}</p>
                {card.detail && <div style={{ marginBottom: '0.5rem' }}>{card.detail}</div>}
                {card.sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
