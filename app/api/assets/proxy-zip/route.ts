import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Extraer la url destino a descargar, la cual puede contener query parameters (eg: ?t=123)
    const urlUrlObj = new URL(request.url)
    const urlParam = urlUrlObj.searchParams.get('url')

    if (!urlParam) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    // Si la URL es public, la reemplazamos por authenticated para que funcione con el service_role key
    // en caso de que el bucket sea realmente privado.
    let targetUrl = urlParam
    if (targetUrl.includes('/storage/v1/object/public/')) {
      targetUrl = targetUrl.replace('/storage/v1/object/public/', '/storage/v1/object/authenticated/')
    }

    // Validar que la URL sea del proyecto Supabase esperado
    const repositoriesUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!secretKey) {
      console.error('Missing required environment variables for Supabase proxy')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const isAuthorized = (repositoriesUrl && targetUrl.startsWith(repositoriesUrl)) || 
                         (supabaseUrl && targetUrl.startsWith(supabaseUrl));

    if (!isAuthorized) {
      return NextResponse.json({ error: 'URL is not authorized for proxy' }, { status: 403 })
    }

    // Realizar la petición usando el secret key para bypass de RLS / privacidad
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'apikey': secretKey
      }
    })

    if (!response.ok) {
      console.error(`Proxy error fetching ${targetUrl}: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        { error: `Failed to fetch asset: ${response.status} ${response.statusText}` }, 
        { status: response.status }
      )
    }

    // Obtener los datos como un ArrayBuffer
    const arrayBuffer = await response.arrayBuffer()

    // Supabase devuelve el archivo en binario de manera correcta, solo pasamos el response body
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/zip',
        'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="download.zip"`,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Error in ZIP proxy:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
