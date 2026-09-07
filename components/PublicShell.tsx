'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import FloatingChatbot from '@/components/FloatingChatbot';
import SiteFooter from '@/components/SiteFooter';

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // /login renders its own full-page layout, so it opts out of the public
  // navbar/footer chrome. The admin panels used to opt out here too; they now
  // live in the separate admin app and are not served from this site at all.
  const isChromeless = pathname?.startsWith('/login');

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}

      {/* FOOTER — reproduced from indiabullssecurities.com */}
      <SiteFooter />

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
    </>
  );
}
