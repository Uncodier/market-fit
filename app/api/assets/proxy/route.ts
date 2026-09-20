import { NextRequest, NextResponse } from 'next/server'
import {
  AssetProxyError,
  createLimitedBodyStream,
  fetchValidatedAsset,
  validateAssetUrl,
  validateRangeHeader,
} from '../proxy-security'
import {
  acquireSemaphore,
  hashRedisKeyPart,
  releaseSemaphore,
} from '@/lib/redis/control-plane'
import { isRedisConfigured } from '@/lib/redis/upstash-rest'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawUrl = searchParams.get('url')
  
  if (!rawUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  let semaphoreKey: string | null = null
  let semaphoreOwner: string | null = null

  try {
    const url = await validateAssetUrl(rawUrl)
    const rangeHeader = validateRangeHeader(request.headers.get('range'))
    if (isRedisConfigured()) {
      const clientIp =
        request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown'
      semaphoreKey = `sem:v1:asset-proxy:ip:${await hashRedisKeyPart(clientIp)}`
      semaphoreOwner = crypto.randomUUID()
      const admitted = await acquireSemaphore(
        semaphoreKey,
        semaphoreOwner,
        2,
        30_000
      )
      if (!admitted) {
        return NextResponse.json(
          { error: 'Too many concurrent asset requests' },
          { status: 429, headers: { 'Retry-After': '2' } }
        )
      }
    }

    const fetched = await fetchValidatedAsset(
      url,
      rangeHeader ? { Range: rangeHeader } : {}
    )
    const response = fetched.response
    if (!response.ok && response.status !== 206) {
      await response.body?.cancel()
      fetched.dispose()
      if (semaphoreKey && semaphoreOwner) {
        await releaseSemaphore(semaphoreKey, semaphoreOwner)
      }
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
    const responseBody = createLimitedBodyStream(response, () => {
      fetched.dispose()
      if (semaphoreKey && semaphoreOwner) {
        void releaseSemaphore(semaphoreKey, semaphoreOwner)
      }
    })

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength } : {}),
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
  } catch (error) {
    if (semaphoreKey && semaphoreOwner) {
      await releaseSemaphore(semaphoreKey, semaphoreOwner)
    }
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