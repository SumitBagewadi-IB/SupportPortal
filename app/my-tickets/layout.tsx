import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Tickets | Indiabulls Securities Support',
  description: 'Track and manage your support tickets with Indiabulls Securities.',
}

export default function MyTicketsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
