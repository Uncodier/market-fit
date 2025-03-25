"use client"

import dynamic from 'next/dynamic'
import LayoutSkeleton from '@/app/components/ui/layout-skeleton'

// Importar dinámicamente layout-client.tsx desde un componente cliente
const LayoutClient = dynamic(() => import('./layout-client'), {
  ssr: true, // Habilitar SSR para el layout
  loading: () => <LayoutSkeleton />
})

export default function ClientWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutClient>{children}</LayoutClient>
} 