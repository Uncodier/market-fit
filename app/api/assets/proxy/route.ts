import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  // Validate that the URL is from our Supabase storage or db.makinari.com
  if (!url.includes('supabase.co') && !url.includes('db.makinari.com')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    // Get Range header for video streaming support
    const rangeHeader = request.headers.get('range')
    
    // Prepare fetch options
    const fetchOptions: RequestInit = {
      headers: {}
    }
    
    // Forward Range header if present (for video streaming)
    if (rangeHeader) {
      fetchOptions.headers = {
        'Range': rangeHeader
      }
    }

    // Fetch the file from Supabase or db.makinari.com
    const response = await fetch(url, fetchOptions)
    
    if (!response.ok && response.status !== 206) { // 206 is Partial Content for Range requests
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')
    const contentRange = response.headers.get('content-range')
    const acceptRanges = response.headers.get('accept-ranges') || 'bytes'

    // Determine if it's a PDF or video
    const isPDF = contentType.includes('pdf') || url.toLowerCase().includes('.pdf')
    const isVideo = contentType.includes('video') || url.toLowerCase().match(/\.(mp4|webm|mov|avi|mkv)$/i)

    // For videos and large files, stream the response instead of loading everything into memory
    if (isVideo && rangeHeader) {
      // Handle Range requests for video streaming
      const buffer = await response.arrayBuffer()
      
      return new NextResponse(buffer, {
        status: response.status, // 206 for partial content
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength || buffer.byteLength.toString(),
          'Content-Range': contentRange || `bytes 0-${buffer.byteLength - 1}/${buffer.byteLength}`,
          'Accept-Ranges': acceptRanges,
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          'Cache-Control': 'public, max-age=31536000',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // For non-video files or full requests, load into memory
    const buffer = await response.arrayBuffer()

    // Create response with proper headers to allow iframe embedding and inline display
    const proxyResponse = new NextResponse(buffer, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || buffer.byteLength.toString(),
        'Content-Disposition': 'inline', // Force inline display, not download
        'Access-Control-Allow-Origin': '*', // Allow CORS for video streaming
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
        'X-Frame-Options': 'SAMEORIGIN', // Allow framing from same origin
        'Content-Security-Policy': "frame-ancestors 'self'", // Allow framing from self
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        // Remove any headers that might force download
        'X-Content-Type-Options': 'nosniff',
        ...((isPDF || isVideo) && {
          'Accept-Ranges': acceptRanges, // Important for PDF and video streaming
        }),
      },
    })

    return proxyResponse

  } catch (error) {
    console.error('Error proxying asset:', error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
} 