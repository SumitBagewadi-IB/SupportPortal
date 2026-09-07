'use client';

import { useCallback } from 'react';

/* Footer reproduced from indiabullssecurities.com so the support portal closes
 * with the same thing as the main site: same logo, social set, app links, SEBI
 * disclosure marquee and the full regulatory block.
 *
 * Images come from the same CDN the main site uses rather than being copied
 * into public/, so a rebrand there carries over here. That host has to be in
 * img-src in firebase.json.
 *
 * The main site's footer also has four accordion columns (About Us, Quick
 * Links, Investors, Segments) whose contents are rendered client-side and are
 * not in its served HTML, so their targets could not be read off the page.
 * They are left out rather than guessed at; the links below are the ones the
 * page actually ships.
 */

const CDN = 'https://image.indiabullssecurities.com/prelogin/assets';
const SITE = 'https://www.indiabullssecurities.com';

const SOCIALS = [
  { label: 'YouTube', href: 'https://www.youtube.com/@Indiabullssec', icon: `${CDN}/icons/ss1.png` },
  { label: 'Instagram', href: 'https://www.instagram.com/indiabullssec/', icon: `${CDN}/icons/ss2.png` },
  { label: 'Twitter', href: 'https://x.com/Indiabullssec', icon: `${CDN}/icons/ss3.png` },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/indiabullssec', icon: `${CDN}/icons/ss4.png` },
  { label: 'Facebook', href: 'https://www.facebook.com/indiabullssec', icon: `${CDN}/icons/ss5.png` },
  { label: 'WhatsApp', href: 'https://www.whatsapp.com/channel/0029Vao60mKK5cDGCf3zJz0m', icon: `${CDN}/icons/ss6.png` },
  { label: 'Telegram', href: 'https://t.me/indiabullssecurities', icon: `${CDN}/icons/ss7.png` },
];

const QUICK_LINKS = [
  { label: 'Blogs', href: `${SITE}/blog` },
  { label: 'Feedback and Suggestions', href: `${SITE}/grievance-redressal/feedback-and-suggestions` },
  {
    label: 'Contact Us',
    href: 'https://storage.googleapis.com/indiabullssecurities/uploads/quicklinks/pdf/Investor_Grievance_Redressal_Mechanism.pdf',
  },
  {
    label: 'Investor Risk Reduction Access (IRRA)',
    href: `${CDN}/home/Investor-Risk-Reduction-Access-(IRRA).pdf`,
  },
  {
    label: 'Client Collateral - Segregation and Allocation',
    href: 'https://www.icclindia.com/DynamicPages/UCCDetails.aspx',
  },
];

// Verbatim from the main site's marquee.
const DISCLOSURES = [
  'Attention Investors! "Prevent Unauthorised Transactions in your account → Update your mobile numbers/email IDs with your stock brokers. Receive information of your transactions directly from Exchange on your mobile/email at the end of the day. Issued in the interest of Investors."',
  'Attention Investors! "Prevent Unauthorized Transactions in your demat account → Update your Mobile Number with your Depository Participant. Receive alerts on your Registered Mobile for all debit and other important transactions in your demat account directly from NSDL/CDSL on the same day. Issued in the interest of investors."',
  'KYC is one time exercise while dealing in securities markets - once KYC is done through a SEBI registered intermediary (broker, DP, Mutual Fund etc.), you need not undergo the same process again when you approach another intermediary.',
  "No need to issue cheques by investors while subscribing to IPO. Just write the bank account number and sign in the application form to authorise your bank to make payment in case of allotment. No worries for refund as the money remains in investor's account.",
  'As per SEBI guidelines, old DIS cannot be accepted for execution of instruction with effect from 07-01-2016. Kindly submit requisition slip / letter for issuance of new DIS booklet at our corporate office address to avoid rejection of your instruction(s) on or after 07-01-2016.',
  'In accordance with the Union Budget 2017-18 announcement, SEBI has advised to link Aadhar with individual demat accounts. Kindly submit details of Aadhar number along with copy of Aadhar Card.',
  'World Investor Week October 14 - 20, 2024 being celebrated under aegis of IOSCO and SEBI.',
  'विश्व निवेशक सप्ताह 14-20 अक्तूबर, 2024 आयस्को तथा सेबी की छत्रछाया में मनाया जा रहा है.',
  'World Investor Week October 06-12, 2025 being celebrated under aegis of IOSCO and SEBI.',
  'विश्व निवेशक सप्ताह 06-12 अक्तूबर, 2025 - आयस्को तथा सेबी की छत्रछाया में मनाया जा रहा है',
];

const REGULATORY = [
  'Indiabulls Securities Limited (Formerly known as Dhani Stocks Limited ) [Corporate Identification Number for ISL: U74999DL2003PLC122874]',
  'SEBI Registration Number (Stock Broker): INZ000036136; NSE Membership Number 08756 (Capital Market, Futures & Options and Currency Derivatives Segment)',
  'BSE Membership Number: 907 (Capital Market, Futures & Options); MCX Membership Number: 12835',
  'SEBI Registration Number (Depository Participant): IN-DP-423-2019; NSDL DP ID: IN302236; CDSL DP ID: 12029900',
  'SEBI Registration Number (Research Analyst): INH000022358; BSE Enlistment Number: 6629',
  'AMFI registration Number ARN-160411 for Mutual Fund Distribution',
  'APMI registration Number APRN06094 for PMS Distribution',
  'Registered office address: A-2, First Floor, Kirti Nagar, New Delhi - 110015. Tel.: 011-41052775, Fax: 011-42137986.',
  'Correspondence office address: Plot no. 108, 5th Floor, IT Park, Udyog Vihar, Phase - I, Gurugram - 122016, Haryana.',
];

export default function SiteFooter() {
  const toTop = useCallback(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  return (
    <footer className="ib-footer">
      <div className="ib-footer-inner">
        {/* Brand, social, app download */}
        <div className="ib-footer-top">
          <div className="ib-footer-brand">
            <img
              src={`${CDN}/images/ib_logo_darkbg.svg`}
              alt="Indiabulls Securities"
              width={160}
              height={48}
              loading="lazy"
            />
          </div>

          <div className="ib-footer-social">
            <h3>Follow Us On</h3>
            <div className="ib-footer-social-row">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Indiabulls Securities on ${s.label}`}
                >
                  <img src={s.icon} alt={s.label} width={28} height={28} loading="lazy" />
                </a>
              ))}
            </div>
          </div>

          <div className="ib-footer-download">
            <h3>Download Now</h3>
            <div className="ib-footer-download-row">
              <figure className="ib-footer-qr">
                <img src={`${CDN}/home/download_app_qr.png`} alt="QR code to download the Indiabulls Securities app" width={96} height={96} loading="lazy" />
                <figcaption>Scan Here</figcaption>
              </figure>
              <div className="ib-footer-stores">
                <a
                  href="https://play.google.com/store/apps/details?id=com.indiabulls.securities&hl=en_IN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={`${CDN}/social/playstore.webp`} alt="Get it on Google Play" width={135} height={40} loading="lazy" />
                </a>
                <a
                  href="https://apps.apple.com/in/app/indiabulls-securities/id6774553361"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={`${CDN}/social/appstore.webp`} alt="Download on the App Store" width={135} height={40} loading="lazy" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Quick links + customer service */}
        <div className="ib-footer-links">
          <nav aria-label="Footer links">
            {QUICK_LINKS.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            ))}
          </nav>
          <p className="ib-footer-service">
            Customer Service <a href="tel:+912261446300">(022-61446300)</a>
          </p>
        </div>
      </div>

      {/* SEBI disclosure marquee */}
      <section className="ib-footer-marquee" aria-label="Attention Investors">
        <span className="ib-footer-marquee-label">Attention Investors</span>
        <div className="ib-footer-marquee-viewport">
          {/* duplicated once so the loop is seamless; the copy is hidden from AT */}
          <div className="ib-footer-marquee-track">
            <span>{DISCLOSURES.join('     •     ')}</span>
            <span aria-hidden="true">{DISCLOSURES.join('     •     ')}</span>
          </div>
        </div>
      </section>

      {/* Regulatory block */}
      <div className="ib-footer-legal">
        <button type="button" onClick={toTop} className="ib-footer-totop">
          Back To Top
        </button>
        <p className="ib-footer-copy">© All rights reserved {new Date().getFullYear()} Indiabulls Securities.</p>
        {REGULATORY.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>
          Email: <a href="mailto:helpdesk@indiabulls.com">helpdesk@indiabulls.com</a>; Tel:{' '}
          <a href="tel:+912261446300">022-61446300</a>
        </p>
        <p>*Applicable in all segments of NSE (CM, FO, CD), BSE (CM, FO) &amp; MCX</p>
      </div>
    </footer>
  );
}
