import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSiteSecret } from '@/app/lib/secrets-service'
import { getZoneByDomain, addDnsRecords, CloudflareDnsRecord } from '@/app/lib/integrations/cloudflare/cloudflare-service'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
  const { data: { user: auth } } = await supabase.auth.getUser();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { siteId, customDomain, targetUrl } = body

    if (!siteId || !customDomain || !targetUrl) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const token = await getSiteSecret(siteId, 'cloudflare', 'dns_sync')
    if (!token) {
      return NextResponse.json({ error: 'Cloudflare not connected' }, { status: 400 })
    }

    const zone = await getZoneByDomain(customDomain, token)
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found in Cloudflare for domain ' + customDomain }, { status: 404 })
    }

    // Clean target URL (remove https://, trailing slashes, paths)
    let cleanTarget = targetUrl
    try {
      if (targetUrl.startsWith('http')) {
        const urlObj = new URL(targetUrl)
        cleanTarget = urlObj.hostname
      }
    } catch(e) {}

    const cfRecord: CloudflareDnsRecord = {
      type: 'CNAME',
      name: customDomain,
      content: cleanTarget,
      proxied: false // DNS Only is safer to avoid redirect loops unless configured otherwise
    }

    const results = await addDnsRecords(zone.id, [cfRecord], token)

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cloudflare sync preview error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
