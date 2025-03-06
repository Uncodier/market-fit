"use client"

import dynamic from 'next/dynamic'

// Importar dinámicamente layout-client.tsx desde un componente cliente
const LayoutClient = dynamic(() => import('./layout-client'), {
  ssr: false,
  loading: () => <div className="min-h-screen w-full flex items-center justify-center bg-background" />
})

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutClient>{children}</LayoutClient>
} 