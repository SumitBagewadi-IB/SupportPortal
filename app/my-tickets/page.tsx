'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const STATUS_CONFIG = {
  open: { label: 'Open', bg: '#FEF3C7', color: '#92400E' },
  in_progress: { label: 'In Progress', bg: '#DBEAFE', color: '#1E40AF' },
  solved: { label: 'Solved', bg: '#D1FAE5', color: '#065F46' },
};

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = JSON.parse(localStorage.getItem('is_tickets') || '[]');
      setTickets(stored);
    } catch {
      setTickets([]);
    }
  }, []);

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
    solved: tickets.filter((t) => t.status === 'solved').length,
  };

  if (!mounted) return null;

  return (
    <div className="page-wrap">
      <div className="container" style={{ maxWidth: 860 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>My Support Requests</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Track and manage your support conversations.</p>
          </div>
          <Link href="/contact" className="btn-primary" style={{ padding: '0.75rem 1.25rem' }}>
            <i className="fas fa-plus"></i> New Ticket
          </Link>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <span className="label">Total Tickets</span>
            <span className="value">{stats.total}</span>
            <span className="trend neutral">Since account start</span>
          </div>
          <div className="stat-card">
            <span className="label">Open Issues</span>
            <span className="value" style={{ color: '#F59E0B' }}>{stats.open}</span>
            <span className="trend positive">Being handled</span>
          </div>
          <div className="stat-card">
            <span className="label">Solved</span>
            <span className="value" style={{ color: '#10B981' }}>{stats.solved}</span>
            <span className="trend positive">Success rate: 100%</span>
          </div>
        </div>

        {/* Tickets list */}
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--bg-subtle)', borderRadius: 16, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>No tickets yet</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Submit a support request to get help</p>
            <Link href="/contact" className="btn-primary">Submit a Ticket</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {tickets.map((ticket) => {
              const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
              const date = new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#00C805'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.07)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{ticket.id}</span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 20, fontWeight: 600, background: statusConf.bg, color: statusConf.color }}>{statusConf.label}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ticket.category}</span>
                      </div>
                      <h3 style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{ticket.subject}</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{ticket.description}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{date}</p>
                      <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.75rem' }}></i>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket detail modal */}
      {selectedTicket && (
        <div onClick={() => setSelectedTicket(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, boxShadow: '0 25px 50px rgba(0,0,0,0.15)', maxWidth: 600, width: '100%', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#F9FFF9' }}>
              <div>
                <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#718096', marginBottom: '0.25rem' }}>{selectedTicket.id}</p>
                <h3 style={{ fontWeight: 700, color: '#1A202C', fontSize: '1rem' }}>{selectedTicket.subject}</h3>
              </div>
              <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#A0AEC0', lineHeight: 1, padding: '0.25rem' }}>&times;</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                {[
                  ['Status', <span key="s" style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: 20, fontWeight: 600, background: STATUS_CONFIG[selectedTicket.status]?.bg, color: STATUS_CONFIG[selectedTicket.status]?.color }}>{STATUS_CONFIG[selectedTicket.status]?.label}</span>],
                  ['Category', selectedTicket.category],
                  ['Name', selectedTicket.name],
                  ['Email', selectedTicket.email],
                  ['Submitted', new Date(selectedTicket.createdAt).toLocaleString('en-IN')],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p style={{ fontSize: '0.7rem', color: '#718096', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</p>
                    <p style={{ fontWeight: 500, color: '#1A202C' }}>{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: '0.7rem', color: '#718096', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Description</p>
                <p style={{ fontSize: '0.875rem', color: '#4A5568', background: '#F7FAFC', borderRadius: 8, padding: '1rem', lineHeight: 1.6 }}>{selectedTicket.description}</p>
              </div>
              <div style={{ borderTop: '1px solid #EDF2F7', marginTop: '1.25rem', paddingTop: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: '#A0AEC0' }}>
                  For urgent help, call <a href="tel:02261446300" style={{ color: '#00C805', fontWeight: 600 }}>022-61446300</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
