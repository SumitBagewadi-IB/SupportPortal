import type { Metadata } from 'next';
import './globals.css';
import PublicShell from '@/components/PublicShell';

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
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
