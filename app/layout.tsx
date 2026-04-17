import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import FloatingChatbot from '@/components/FloatingChatbot';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Indiabulls Securities Support | Help Center',
  description: 'Find answers, guides and support for Indiabulls Securities trading platform.',
  openGraph: {
    title: 'Indiabulls Securities Support | Help Center',
    description: 'Find answers, guides and support for Indiabulls Securities trading platform.',
    url: 'https://support.indiabulls.com',
    siteName: 'Indiabulls Securities Support',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Indiabulls Securities Support | Help Center',
    description: 'Find answers, guides and support for Indiabulls Securities trading platform.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'light';if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}})();`,
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          integrity="sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <Navbar />
        {children}

        {/* FOOTER */}
        <footer>
          <div className="container">
            <div className="footer-top">
              <div className="footer-col">
                <p className="footer-col-title">Support</p>
                <Link href="/faq">Knowledge Base</Link>
                <Link href="/contact">Contact Us</Link>
                <Link href="/my-tickets">My Tickets</Link>
              </div>
              <div className="footer-col">
                <p className="footer-col-title">Legal</p>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Disclosures</a>
                <a href="#">Risk Disclosure</a>
              </div>
              <div className="footer-col">
                <p className="footer-col-title">Regulatory</p>
                <a href="https://www.sebi.gov.in" target="_blank" rel="noopener noreferrer">
                  SEBI <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }}></i>
                </a>
                <a href="https://www.nseindia.com" target="_blank" rel="noopener noreferrer">
                  NSE <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }}></i>
                </a>
                <a href="https://www.bseindia.com" target="_blank" rel="noopener noreferrer">
                  BSE <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }}></i>
                </a>
                <a href="https://www.cdslindia.com" target="_blank" rel="noopener noreferrer">
                  CDSL <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }}></i>
                </a>
              </div>
              <div className="footer-col">
                <p className="footer-col-title">Investor Services</p>
                <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener noreferrer">
                  SCORES Grievance <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }}></i>
                </a>
                <a href="#">Grievance Redressal</a>
                <a href="#">Investor Education</a>
                <a href="#">Advisory Notice</a>
              </div>
            </div>
            <div className="footer-bottom">
              <p>&copy; 2025 Indiabulls Securities Limited. All rights reserved. | SEBI Reg. No.: INZ000002809 | CDSL: IN-DP-CDSL-30-99</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Investments in securities market are subject to market risks. Read all the related documents carefully before investing.
              </p>
            </div>
          </div>
        </footer>

        {/* DEMO MODAL */}
        <div className="demo-modal" id="demoModal">
          <div className="modal-box">
            <div className="modal-bar">
              <h4 id="modalTitle">Feature Demo</h4>
              <button className="modal-close-btn" id="closeModal">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <img id="demoMedia" src="" alt="Demo" />
          </div>
        </div>

        <FloatingChatbot />
      </body>
    </html>
  );
}
