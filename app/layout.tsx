import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import ClientLayout from './client-layout'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Market Fit',
  description: 'Encuentra el ajuste perfecto de tu producto al mercado',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
        <Toaster />
      </body>
    </html>
  )
} 