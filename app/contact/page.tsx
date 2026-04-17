'use client';

// Metadata cannot be exported from a 'use client' component.
// Add metadata in app/contact/layout.tsx if needed.

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const CATEGORIES = [
  'Getting Started',
  'Account Opening',
  'Trading',
  'Portfolio & Margin',
  'Funds',
  'Charges & Brokerage',
  'Compliance & Safety',
  'Mutual Funds',
  'IPO',
  'F&O',
  'Pledging',
  'MTF',
  'Tender Offers',
  'Contact & Help',
  'Advanced',
  'Account',
  'Reports',
  'NRI/HUF Accounts',
  'Other',
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
  const num = Math.floor(10000 + Math.random() * 90000);
  return `TIC-${num}`;
}

interface Ticket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'solved';
  createdAt: string;
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: '',
    subject: '',
    description: '',
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setSuggestions(getSuggestions(form.subject));
  }, [form.subject]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = 'Invalid email';
    if (!form.category) newErrors.category = 'Please select a category';
    if (!form.subject.trim()) newErrors.subject = 'Subject is required';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const id = generateTicketId();
    const ticket: Ticket = {
      id,
      ...form,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    try {
      const existing: Ticket[] = JSON.parse(localStorage.getItem('is_tickets') || '[]');
      existing.unshift(ticket);
      localStorage.setItem('is_tickets', JSON.stringify(existing));
    } catch {
      // ignore storage errors
    }

    // Fire-and-forget: also store ticket in DynamoDB via API
    if (API_BASE) {
      fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticket),
      }).catch(() => {
        // silently ignore - localStorage is the fallback
      });
    }

    setTicketId(id);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#00C80520' }}>
          <svg className="w-8 h-8" style={{ color: '#00C805' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ticket Submitted!</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Your ticket <span className="font-semibold text-green-600">{ticketId}</span> has been created.
          We&apos;ll get back to you within 24 hours.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/my-tickets"
            className="px-5 py-2.5 rounded-xl text-white font-medium text-sm"
            style={{ backgroundColor: '#00C805' }}
          >
            View My Tickets
          </Link>
          <button
            onClick={() => { setSubmitted(false); setForm({ name: '', email: '', category: '', subject: '', description: '' }); }}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Contact Us</h1>
        <p className="text-gray-500 dark:text-gray-400">Submit a support request and we&apos;ll get back to you</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-green-500 ${errors.name ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-green-500 ${errors.email ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-green-500 ${errors.category ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of your issue"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-green-500 ${errors.subject ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject}</p>}
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">
                  You might find these articles helpful:
                </p>
                <ul className="space-y-1">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <Link href="/faq" className="text-sm text-green-600 dark:text-green-400 hover:underline">
                        → {s}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Please describe your issue in detail..."
                rows={5}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-green-500 resize-none ${errors.description ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'}`}
              />
              {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#00C805' }}
            >
              Submit Ticket
            </button>
          </form>
        </div>

        {/* Contact info */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                  <a href="tel:02261446300" className="text-sm font-medium text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">
                    022-61446300
                  </a>
                  <p className="text-xs text-gray-400 mt-0.5">Mon–Sat, 8 AM – 8 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                  <a href="mailto:support@indiabulls.com" className="text-sm font-medium text-gray-900 dark:text-white hover:text-green-600 dark:hover:text-green-400">
                    support@indiabulls.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Indiabulls Finance Centre, Tower 1,<br />
                    Senapati Bapat Marg, Elphinstone Road,<br />
                    Mumbai – 400013
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Response Time</h3>
            <div className="space-y-2">
              {[
                { label: 'Email support', time: '< 24 hours' },
                { label: 'Phone support', time: 'Immediate' },
                { label: 'Critical issues', time: '< 4 hours' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-5">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>For SEBI Complaints:</strong> Use the SCORES portal at{' '}
              <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                scores.sebi.gov.in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
