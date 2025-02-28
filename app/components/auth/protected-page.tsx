import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface ProtectedPageProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function ProtectedPage({ 
  children, 
  redirectTo = '/auth/login' 
}: ProtectedPageProps) {
  const cookieStore = cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })

  // Siempre usar getUser() para validar la autenticación
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    const searchParams = new URLSearchParams()
    
    // Obtener la ruta actual del pathname
    const currentPath = window.location.pathname
    
    // Solo agregar returnTo si no es una ruta de autenticación
    if (!currentPath.startsWith('/auth/')) {
      searchParams.set('returnTo', currentPath)
    }

    const redirectUrl = `${redirectTo}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    redirect(redirectUrl)
  }

  return <>{children}</>
} 