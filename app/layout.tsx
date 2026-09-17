import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Satvikdaan - Donor & Beneficiary Management',
  description: 'Comprehensive management system for nonprofit beneficiary and donor tracking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  )
}
