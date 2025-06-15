import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  // Validate that the URL is from our Supabase storage
  if (!url.includes('supabase.co')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    // Fetch the file from Supabase
    const response = await fetch(url)
    
    if (!response.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = await response.arrayBuffer()

    // Determine if it's a PDF
    const isPDF = contentType.includes('pdf') || url.toLowerCase().includes('.pdf')

    // Create response with proper headers to allow iframe embedding and inline display
    const proxyResponse = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.byteLength.toString(),
        'Content-Disposition': 'inline', // Force inline display, not download
        'X-Frame-Options': 'SAMEORIGIN', // Allow framing from same origin
        'Content-Security-Policy': "frame-ancestors 'self'", // Allow framing from self
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        // Remove any headers that might force download
        'X-Content-Type-Options': 'nosniff',
        ...(isPDF && {
          'Accept-Ranges': 'bytes', // Important for PDF streaming
        }),
      },
    })

    return proxyResponse

  } catch (error) {
    console.error('Error proxying asset:', error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
} 