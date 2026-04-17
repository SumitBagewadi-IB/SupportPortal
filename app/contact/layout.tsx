import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Us | Indiabulls Securities Support',
  description: 'Get in touch with Indiabulls Securities support team via chat, phone or submit a ticket.',
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
