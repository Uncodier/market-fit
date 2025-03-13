import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import ClientWrapper from './client-wrapper'
import Script from 'next/script'

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
      <head>
        <Script 
          src="/js/tracking.min.js" 
          data-site-id="www.uncodie.com" 
          data-debug="true"
          data-experiments="true"
        />
      </head>
      <body className={inter.className}>
        <ClientWrapper>
          {children}
        </ClientWrapper>
        <Toaster />
      </body>
    </html>
  )
} 