import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  AssetProxyError,
  fetchValidatedAsset,
  readLimitedBody,
  validateAssetUrl,
} from '../proxy-security'

export async function GET(request: NextRequest) {
  try {
    const urlParam = request.nextUrl.searchParams.get('url')

    if (!urlParam) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    const targetUrl = await validateAssetUrl(urlParam)

    const supabase = await createClient(true)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fetched = await fetchValidatedAsset(
      targetUrl,
      {},
      { sameHostRedirectsOnly: true }
    )
    try {
      const response = fetched.response

      if (!response.ok) {
        console.error(
          `ZIP proxy upstream failure from ${targetUrl.hostname}: ${response.status}`
        )
        return NextResponse.json(
          { error: `Failed to fetch asset: ${response.status}` },
          { status: response.status }
        )
      }

      const body = await readLimitedBody(response)
      const responseBody = new Uint8Array(body).buffer

      return new NextResponse(responseBody, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'application/zip',
          'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="download.zip"`,
          'Content-Length': body.byteLength.toString(),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        }
      })
    } finally {
      fetched.dispose()
    }

  } catch (error) {
    if (error instanceof AssetProxyError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error in ZIP proxy:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
