import { NextRequest, NextResponse } from 'next/server'
import { getSiteSecret } from '@/app/lib/secrets-service'
import { getZoneByDomain, addDnsRecords, CloudflareDnsRecord } from '@/app/lib/integrations/cloudflare/cloudflare-service'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { acquireOperationLease, type OperationLease } from '@/lib/redis/operation-lease'

const MAX_RECORDS = 100

export async function POST(req: NextRequest) {
  let lease: OperationLease | null = null
  try {
    const body = await req.json()
    const { siteId, domain, records, replaceConflictingInboundMx = false } = body

    if (!siteId || !domain || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }
    if (records.length === 0 || records.length > MAX_RECORDS) {
      return NextResponse.json({ error: 'Invalid DNS record count' }, { status: 400 })
    }

    const access = await requireSiteAccess(req, siteId, {
      requireManager: true,
    })
    if (access.error) return access.error
    lease = await acquireOperationLease('cloudflare-sync', siteId, 60_000)
    if (!lease) {
      return NextResponse.json(
        { error: 'A Cloudflare synchronization is already running' },
        { status: 429, headers: { 'Retry-After': '5' } }
      )
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

    const results = await addDnsRecords(zone.id, cfRecords, token, {
      replaceConflictingInboundMx: replaceConflictingInboundMx === true
    })
    const failedRecord = results.find((result: { error?: boolean }) => result.error)
    if (failedRecord) {
      return NextResponse.json(
        {
          error: failedRecord.details?.[0]?.message || `Failed to sync ${failedRecord.type} record`,
          results
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('Cloudflare sync zavu error:', error)
    if (error instanceof Error && error.message.toLowerCase().includes('invalid access token')) {
      return NextResponse.json(
        {
          error: 'Cloudflare authorization expired. Reconnect Cloudflare to continue.',
          code: 'cloudflare_reauth_required'
        },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  } finally {
    await lease?.release()
  }
}
