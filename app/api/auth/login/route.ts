import { NextResponse } from 'next/server'

// Indicar a Next.js que esta ruta es dinámica
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Leer variables de entorno
    const clientId = process.env.AUTH0_CLIENT_ID
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    
    // Verificar que las variables de entorno requeridas estén definidas
    if (!clientId || !issuerBaseUrl) {
      console.error('Error: Faltan variables de entorno de Auth0:', { 
        clientId: !!clientId, 
        issuerBaseUrl: !!issuerBaseUrl 
      })
      return NextResponse.json(
        { error: 'Error de configuración - Faltan variables de entorno de Auth0' }, 
        { status: 500 }
      )
    }
    
    // Asegurarnos de que la URL de Auth0 incluya el protocolo
    const fullIssuerUrl = issuerBaseUrl.startsWith('https://') 
      ? issuerBaseUrl 
      : `https://${issuerBaseUrl}`
    
    // Obtener returnTo del querystring de manera segura
    let returnTo = '/'
    try {
      const url = new URL(request.url)
      returnTo = url.searchParams.get('returnTo') || '/'
    } catch (error) {
      console.error('Error al parsear request.url:', error)
    }
    
    // Construir URI de redirección
    const redirectUri = `${appUrl}/api/auth/callback`
    
    // Construir URL de Auth0
    const auth0AuthUrl = new URL(`${fullIssuerUrl}/authorize`)
    
    // Configurar parámetros para Auth0
    auth0AuthUrl.searchParams.set('response_type', 'code')
    auth0AuthUrl.searchParams.set('client_id', clientId)
    auth0AuthUrl.searchParams.set('redirect_uri', redirectUri)
    auth0AuthUrl.searchParams.set('scope', 'openid profile email')
    
    // Añadir state para protección CSRF y para pasar returnTo (simplificado para evitar errores)
    const state = encodeURIComponent(JSON.stringify({ returnTo }))
    auth0AuthUrl.searchParams.set('state', state)
    
    console.log('Redirigiendo a Auth0:', auth0AuthUrl.toString())
    
    // Redirigir al usuario al login de Auth0
    return NextResponse.redirect(auth0AuthUrl.toString())
  } catch (error) {
    console.error('Error iniciando autenticación:', error)
    return NextResponse.json(
      { error: 'Error del servidor', details: (error as Error).message }, 
      { status: 500 }
    )
  }
} 