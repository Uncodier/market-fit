"use client"

import { Suspense, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ThemeProvider } from './context/ThemeContext'

// Importación dinámica del LayoutClient
const LayoutClient = dynamic(() => import('./layout-client'), {
  ssr: false,
  loading: () => <div className="min-h-screen w-full flex items-center justify-center bg-background" />
})

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isClient, setIsClient] = useState(false)

  // Detectar cuando estamos en el cliente
  useEffect(() => {
    setIsClient(true)
  }, [])

  // En el servidor o durante la hidratación, mostrar un contenedor simple
  if (!isClient) {
    return (
      <div className="min-h-screen w-full bg-background">
        {/* Placeholder mientras se carga el cliente */}
      </div>
    )
  }

  // Una vez que estamos en el cliente, cargar el layout completo
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-background" />}>
        <LayoutClient>{children}</LayoutClient>
      </Suspense>
    </ThemeProvider>
  )
} 