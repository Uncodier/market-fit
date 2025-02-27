import { NextResponse } from 'next/server'
import { syncAuth0User } from '@/app/lib/auth-utils'
import { jwtDecode } from 'jwt-decode'

// Indicar a Next.js que esta ruta es dinámica
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Leer variables de entorno
    const clientId = process.env.AUTH0_CLIENT_ID
    const clientSecret = process.env.AUTH0_CLIENT_SECRET
    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    
    // Verificar que las variables de entorno requeridas estén definidas
    if (!clientId || !clientSecret || !issuerBaseUrl) {
      console.error('Error: Faltan variables de entorno de Auth0')
      return NextResponse.json(
        { error: 'Error de configuración - Faltan variables de entorno de Auth0' }, 
        { status: 500 }
      )
    }
    
    // Asegurarnos de que la URL de Auth0 incluya el protocolo
    const fullIssuerUrl = issuerBaseUrl.startsWith('https://') 
      ? issuerBaseUrl 
      : `https://${issuerBaseUrl}`
    
    // Obtener código y state de la URL de manera segura
    let code = null
    let stateParam = null
    let returnTo = '/'
    
    try {
      const url = new URL(request.url)
      code = url.searchParams.get('code')
      stateParam = url.searchParams.get('state')
    } catch (error) {
      console.error('Error al parsear request.url:', error)
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }
    
    // Decodificar state para obtener returnTo (usando el nuevo formato)
    if (stateParam) {
      try {
        const decodedState = JSON.parse(decodeURIComponent(stateParam))
        returnTo = decodedState.returnTo || '/'
        console.log('returnTo decodificado:', returnTo)
      } catch (error) {
        console.error('Error decodificando state:', error)
      }
    }
    
    if (!code) {
      return NextResponse.json({ error: 'Código de autorización no proporcionado' }, { status: 400 })
    }

    console.log('Obteniendo token con código de autorización')
    
    // Preparar URL y datos para el intercambio de código por token
    const tokenUrl = `${fullIssuerUrl}/oauth/token`
    const redirectUri = `${appUrl}/api/auth/callback`
    
    // Intercambiar código por token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri
      })
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('Error obteniendo token:', tokenData)
      return NextResponse.json({ 
        error: 'Error de autenticación', 
        details: tokenData.error_description || tokenData.error
      }, { status: 401 })
    }

    // Validar el ID token antes de usarlo
    if (!tokenData.id_token) {
      console.error('Token de ID no recibido de Auth0')
      return NextResponse.json({ error: 'Token de ID no recibido' }, { status: 401 })
    }

    // Verificar que el token sea decodificable y tenga la estructura esperada
    try {
      const decodedToken = jwtDecode(tokenData.id_token)
      if (!decodedToken || typeof decodedToken !== 'object') {
        throw new Error('Token inválido o malformado')
      }
    } catch (tokenError) {
      console.error('Error validando token:', tokenError)
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    console.log('Token obtenido correctamente, obteniendo información del usuario')
    
    // Obtener información del usuario
    const userResponse = await fetch(`${fullIssuerUrl}/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })

    const userData = await userResponse.json()
    
    if (!userResponse.ok) {
      console.error('Error obteniendo información del usuario:', userData)
      return NextResponse.json({ error: 'Error obteniendo información del usuario' }, { status: 401 })
    }

    console.log('Información del usuario obtenida, sincronizando con Supabase')
    
    // Sincronizar usuario con Supabase
    await syncAuth0User({
      sub: userData.sub,
      email: userData.email,
      name: userData.name,
      picture: userData.picture
    })

    console.log('Usuario sincronizado, redirigiendo a:', returnTo)
    
    // Configurar respuesta de redirección correctamente
    // Construir URL absoluta para la redirección
    const finalRedirectUrl = new URL(returnTo, appUrl).toString()
    const response = NextResponse.redirect(finalRedirectUrl)
    
    // Establecer cookie con el token ID (ajustar maxAge según tus necesidades)
    response.cookies.set({
      name: 'auth0_token',
      value: tokenData.id_token,
      httpOnly: false, // Cambiar a true para más seguridad en producción
      secure: process.env.NODE_ENV === 'production',
      maxAge: tokenData.expires_in,
      path: '/'
    })

    // Depuración para ver si la cookie se establece correctamente
    console.log('Cookie auth0_token establecida con éxito')

    return response
  } catch (error) {
    console.error('Error en callback:', error)
    return NextResponse.json({ 
      error: 'Error del servidor', 
      details: (error as Error).message 
    }, { status: 500 })
  }
} 