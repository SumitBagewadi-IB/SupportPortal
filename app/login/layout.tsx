import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | Indiabulls Securities Support',
  description: 'Sign in to your Indiabulls Securities support account.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
