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
    const { siteId, domain, records } = body

    if (!siteId || !domain || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const token = await getSiteSecret(siteId, 'cloudflare', 'dns_sync')
    if (!token) {
      return NextResponse.json({ error: 'Cloudflare not connected' }, { status: 400 })
    }

    const zone = await getZoneByDomain(domain, token)
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found in Cloudflare for domain ' + domain }, { status: 404 })
    }

    const cfRecords: CloudflareDnsRecord[] = records.map((r: any) => {
      const name = r.host || r.name
      const content = r.value || r.content || r.data
      const proxied = r.proxied !== undefined ? r.proxied : false

      return {
        type: r.type,
        name: name,
        content: content,
        priority: r.priority,
        proxied: proxied
      }
    })

    const results = await addDnsRecords(zone.id, cfRecords, token)

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cloudflare sync zavu error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
