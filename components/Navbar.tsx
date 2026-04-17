'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const handler = () => {
      const html = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    };
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <nav aria-label="Main navigation">
      <div className="container">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="Indiabulls Securities" className="logo-light" />
          <img src="/logo-dark.svg" alt="Indiabulls Securities" className="logo-dark" />
        </Link>

        {/* Desktop nav links */}
        <ul className="nav-links">
          <li><Link href="/" className={pathname === '/' ? 'active' : ''}>Home</Link></li>
          <li><Link href="/faq" className={pathname === '/faq' ? 'active' : ''}>Knowledge Base</Link></li>
          <li><Link href="/contact" className={pathname === '/contact' ? 'active' : ''}>Contact Us</Link></li>
          <li><Link href="/my-tickets" className={pathname === '/my-tickets' ? 'active' : ''}>My Tickets</Link></li>
        </ul>

        {/* Desktop CTA buttons */}
        <div className="nav-cta">
          <a href="https://stocks-onboarding.indiabullssecurities.com/login?_gl=1*gubd0s*_gcl_au*NTYzNDE2NTg2LjE3NzU4Mjg1Njg." target="_blank" rel="noopener noreferrer" className="btn-signin btn-open-account">Open Account</a>
          <a href="https://trade.ibullssecurities.com/dashboard" target="_blank" rel="noopener noreferrer" className="btn-signin">Login</a>
        </div>

        {/* Hamburger button (mobile only) */}
        <button
          className="hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`hamburger-line${menuOpen ? ' open' : ''}`}></span>
          <span className={`hamburger-line${menuOpen ? ' open' : ''}`}></span>
          <span className={`hamburger-line${menuOpen ? ' open' : ''}`}></span>
        </button>

        <button id="themeToggle" className="theme-toggle" aria-label="Toggle dark mode">
          <i className="fas fa-moon"></i>
          <i className="fas fa-sun"></i>
        </button>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="mobile-menu" role="dialog" aria-label="Mobile navigation">
          <ul>
            <li><Link href="/" className={pathname === '/' ? 'active' : ''}>Home</Link></li>
            <li><Link href="/faq" className={pathname === '/faq' ? 'active' : ''}>Knowledge Base</Link></li>
            <li><Link href="/contact" className={pathname === '/contact' ? 'active' : ''}>Contact Us</Link></li>
            <li><Link href="/my-tickets" className={pathname === '/my-tickets' ? 'active' : ''}>My Tickets</Link></li>
          </ul>
          <div className="mobile-menu-cta">
            <a href="https://stocks-onboarding.indiabullssecurities.com/login?_gl=1*gubd0s*_gcl_au*NTYzNDE2NTg2LjE3NzU4Mjg1Njg." target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--green)', color: 'white', border: 'none' }}>Open Account</a>
            <a href="https://trade.ibullssecurities.com/dashboard" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Login</a>
          </div>
        </div>
      )}
    </nav>
  );
}
