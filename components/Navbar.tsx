'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();

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

  return (
    <nav aria-label="Main navigation">
      <div className="container">
        <Link href="/" className="logo">
          <img src="/logo.svg" alt="Indiabulls Securities" className="logo-light" />
          <img src="/logo-dark.svg" alt="Indiabulls Securities" className="logo-dark" />
        </Link>
        <ul className="nav-links">
          <li><Link href="/" className={pathname === '/' ? 'active' : ''}>Home</Link></li>
          <li><Link href="/faq" className={pathname === '/faq' ? 'active' : ''}>Knowledge Base</Link></li>
          <li><Link href="/contact" className={pathname === '/contact' ? 'active' : ''}>Contact Us</Link></li>
          <li><Link href="/my-tickets" className={pathname === '/my-tickets' ? 'active' : ''}>My Tickets</Link></li>
        </ul>
        <a href="/login" className="btn-signin">Sign In</a>
        <button id="themeToggle" className="theme-toggle" aria-label="Toggle dark mode">
          <i className="fas fa-moon"></i>
          <i className="fas fa-sun"></i>
        </button>
      </div>
    </nav>
  );
}
