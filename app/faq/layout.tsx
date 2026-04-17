import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Knowledge Base | Indiabulls Securities Support',
  description: 'Browse help articles on trading, funds, account opening, charges, compliance and more.',
}

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
