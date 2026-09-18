import { NextRequest, NextResponse } from 'next/server'
import {
  AssetProxyError,
  fetchValidatedAsset,
  readLimitedBody,
  validateAssetUrl,
  validateRangeHeader,
} from '../proxy-security'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawUrl = searchParams.get('url')
  
  if (!rawUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  try {
    const url = await validateAssetUrl(rawUrl)
    const rangeHeader = validateRangeHeader(request.headers.get('range'))
    const fetched = await fetchValidatedAsset(
      url,
      rangeHeader ? { Range: rangeHeader } : {}
    )
    try {
      const response = fetched.response
      if (!response.ok && response.status !== 206) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const contentLength = response.headers.get('content-length')
      const contentRange = response.headers.get('content-range')
      const acceptRanges = response.headers.get('accept-ranges') || 'bytes'

      const isPDF = contentType.includes('pdf') || url.pathname.toLowerCase().endsWith('.pdf')
      const isVideo =
        contentType.includes('video') ||
        /\.(mp4|webm|mov|avi|mkv)$/i.test(url.pathname)
      const isExplicitlyPublicStorageAsset =
        url.pathname.startsWith('/storage/v1/object/public/') &&
        !url.searchParams.has('token')
      const buffer = await readLimitedBody(response)
      const responseBody = new Uint8Array(buffer).buffer

      return new NextResponse(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength || buffer.byteLength.toString(),
          ...(contentRange ? { 'Content-Range': contentRange } : {}),
          'Content-Disposition': 'inline',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          'X-Frame-Options': 'SAMEORIGIN',
          'Content-Security-Policy': "frame-ancestors 'self'",
          'Cache-Control': isExplicitlyPublicStorageAsset
            ? 'public, max-age=31536000'
            : 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          ...((isPDF || isVideo) && {
            'Accept-Ranges': acceptRanges,
          }),
        },
      })
    } finally {
      fetched.dispose()
    }
  } catch (error) {
    if (error instanceof AssetProxyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status === 403 ? 400 : error.status }
      )
    }
    console.error('Error proxying asset:', error)
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 500 })
  }
} 