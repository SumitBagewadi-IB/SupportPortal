import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin | Indiabulls Securities Support',
  description: 'Admin panel for managing support articles and tickets.',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
