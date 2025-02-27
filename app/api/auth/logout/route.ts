import { NextResponse } from 'next/server'

// Indicar a Next.js que esta ruta es dinámica
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Determinar la URL base de la aplicación
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                 (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
    
    // Si no se configura Auth0, simplemente redirigir a la página de login
    if (!process.env.AUTH0_ISSUER_BASE_URL || !process.env.AUTH0_CLIENT_ID) {
      console.warn('AUTH0_ISSUER_BASE_URL o AUTH0_CLIENT_ID no están configurados. Fallback a redirección directa.')
      const response = NextResponse.redirect(`${appUrl}/auth/login`)
      response.cookies.delete('auth0_token')
      return response
    }
    
    // Configurar URL de logout de Auth0
    const logoutUrl = new URL(`${process.env.AUTH0_ISSUER_BASE_URL}/v2/logout`)
    logoutUrl.searchParams.append('client_id', process.env.AUTH0_CLIENT_ID)
    logoutUrl.searchParams.append('returnTo', appUrl)
    
    // Crear respuesta y eliminar cookie de autenticación
    const response = NextResponse.redirect(logoutUrl.toString())
    response.cookies.delete('auth0_token')
    
    return response
  } catch (error) {
    console.error('Error en logout:', error)
    
    // En caso de error, intentar redirigir a la página de login
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = NextResponse.redirect(`${appUrl}/auth/login`)
      response.cookies.delete('auth0_token')
      return response
    } catch {
      // Si todo falla, devolver un error JSON
      return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
    }
  }
} 