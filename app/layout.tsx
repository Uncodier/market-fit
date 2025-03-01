import type { Metadata } from 'next'
import LayoutClient from './layout-client'
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"

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
    <html lang="es">
      <body className={inter.className}>
        <LayoutClient>{children}</LayoutClient>
        <Toaster />
      </body>
    </html>
  )
} 