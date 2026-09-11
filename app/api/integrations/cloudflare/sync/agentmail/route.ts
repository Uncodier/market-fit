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

    // AgentMail records usually have type, host, value. We need to map to Cloudflare format
    // Cloudflare uses: type, name, content
    const cfRecords: CloudflareDnsRecord[] = records.map((r: any) => {
      // Map standard format to Cloudflare format
      const name = r.host || r.name
      const content = r.value || r.content || r.data
      
      // Determine proxied status based on record type or explicit flag
      // MX and TXT are never proxied. CNAME can be, but for email validation they usually must be DNS Only.
      const proxied = r.proxied !== undefined ? r.proxied : false

      return {
        type: r.type,
        name: name,
        content: content,
        priority: r.priority, // Some MX records have priority
        proxied: proxied
      }
    })

    const results = await addDnsRecords(zone.id, cfRecords, token)

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cloudflare sync agentmail error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
