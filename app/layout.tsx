import type { Metadata, Viewport } from 'next'
import "./globals.css"
import "./safari-fix.css"
import { Toaster } from "sonner"
import ClientWrapper from './client-wrapper'
import { Suspense } from 'react'
import Providers from "./providers/Providers"
import LoggerInit from './components/LoggerInit'
import ChunkErrorGuard from './components/ChunkErrorGuard'
import EarlyBrowserInit from './components/EarlyBrowserInit'
import TrackingInit from './components/TrackingInit'
import SafariIconFix from './components/SafariIconFix'
import MuseoFont from './components/MuseoFont'
import { inter } from './lib/fonts'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://makinari.com'),
  title: 'MAKINARI',
  description: 'Find your product market fit.',
  icons: {
    icon: '/images/logo.png',
    apple: '/images/logo.png',
  },
  openGraph: {
    title: 'MAKINARI',
    description: 'Find your product market fit.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAKINARI',
    description: 'Find your product market fit.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={inter.variable}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )makinari-locale=([^;]+)/);var l=m&&m[1];if(l==='en'||l==='es'||l==='fr'||l==='de'||l==='ja'){document.documentElement.lang=l;if(l!=='en')document.documentElement.classList.add('locale-pending')}}catch(e){}var href='https://fonts.googleapis.com/css2?family=Museo+Moderno:wght@400;600;700&display=swap';var link=document.createElement('link');link.rel='stylesheet';link.href=href;link.media='print';link.onload=function(){link.media='all';document.documentElement.classList.add('museo-ready')};document.head.appendChild(link)})();`,
          }}
        />
        <meta name="application-name" content="MAKINARI" />
        <meta name="apple-mobile-web-app-title" content="MAKINARI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-sans">
        <EarlyBrowserInit />
        <Providers>
          <LoggerInit />
          <ChunkErrorGuard />
          <main className="min-h-[100dvh] bg-background overflow-visible">
            <Suspense fallback={null}>
              <ClientWrapper>
                {children}
              </ClientWrapper>
            </Suspense>
            <Toaster />
          </main>
        </Providers>
        <TrackingInit />
        <SafariIconFix />
        <MuseoFont />
      </body>
    </html>
  )
}
