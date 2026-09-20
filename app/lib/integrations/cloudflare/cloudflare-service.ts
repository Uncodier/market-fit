import {
  isCurrentZavuInboundMx,
  isReplaceableInboundMxConflict
} from '@/lib/zavu-email-dns'

export interface CloudflareZone {
  id: string
  name: string
  status: string
}

export interface CloudflareDnsRecord {
  type: string
  name: string
  content: string
  ttl?: number
  proxied?: boolean
  priority?: number
}

export interface AddDnsRecordsOptions {
  replaceConflictingInboundMx?: boolean
}

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'
const CF_TIMEOUT_MS = 10_000

async function fetchCloudflare(
  input: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CF_TIMEOUT_MS)
  const abort = () => controller.abort()
  init.signal?.addEventListener("abort", abort, { once: true })
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener("abort", abort)
  }
}

/**
 * Searches for a zone by domain name. 
 * E.g. 'example.com' or a subdomain like 'app.example.com'.
 * In Cloudflare, a zone is typically the root domain (example.com).
 * This function tries to find the matching zone.
 */
export async function getZoneByDomain(domain: string, token: string): Promise<CloudflareZone | null> {
  // To handle complex TLDs (like .co.uk, .com.mx), fetch zones and find the best match
  // For most tokens, the number of zones is small enough that a single API call is fast
  let res = await fetchCloudflare(`${CF_API_BASE}/zones?per_page=50`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  let data = await res.json()

  if (!data.success && data.errors && data.errors.length > 0) {
    throw new Error(`Cloudflare API error: ${data.errors[0].message}`)
  }
  
  if (data.success && data.result && data.result.length > 0) {
    // Find all zones where the domain ends with the zone name (either exact match or subdomain match)
    const matchingZones = data.result.filter((z: CloudflareZone) => 
      domain === z.name || domain.endsWith('.' + z.name)
    )
    
    if (matchingZones.length > 0) {
      // Sort by length descending to get the most specific zone (e.g. if they have 'example.com' and 'sub.example.com')
      matchingZones.sort((a: CloudflareZone, b: CloudflareZone) => b.name.length - a.name.length)
      return matchingZones[0] as CloudflareZone
    }
  }

  // Fallback to exact match search if per_page=50 didn't catch it
  const domainParts = domain.split('.')
  let searchName = domain
  if (domainParts.length > 2) {
    searchName = domainParts.slice(-2).join('.')
  }

  res = await fetchCloudflare(`${CF_API_BASE}/zones?name=${searchName}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  data = await res.json()

  if (!data.success && data.errors && data.errors.length > 0) {
    throw new Error(`Cloudflare API error: ${data.errors[0].message}`)
  }

  if (!data.result || data.result.length === 0) {
    res = await fetchCloudflare(`${CF_API_BASE}/zones?name=${domain}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    data = await res.json()

    if (!data.success && data.errors && data.errors.length > 0) {
      throw new Error(`Cloudflare API error: ${data.errors[0].message}`)
    }
  }

  if (data.result && data.result.length > 0) {
    return data.result[0] as CloudflareZone
  }

  return null
}

/**
 * Agrega registros DNS a una zona dada.
 */
export async function addDnsRecords(
  zoneId: string,
  records: CloudflareDnsRecord[],
  token: string,
  options: AddDnsRecordsOptions = {}
): Promise<any> {
  const results = []
  for (const record of records) {
    let recordSucceeded = true
    if (
      options.replaceConflictingInboundMx &&
      (record.type !== 'MX' || !isCurrentZavuInboundMx(record.content))
    ) {
      throw new Error('Inbound MX replacement requires the current Zavu MX target')
    }

    const existingRes = await fetchCloudflare(`${CF_API_BASE}/zones/${zoneId}/dns_records?type=${record.type}&name=${record.name}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const existingData = await existingRes.json()
    if (!existingRes.ok || !existingData.success) {
      throw new Error(existingData.errors?.[0]?.message || `Failed to read ${record.type} records from Cloudflare`)
    }

    const normalizeContent = (value: string) =>
      record.type === 'MX' || record.type === 'CNAME' || record.type === 'NS'
        ? value.toLowerCase().replace(/\.$/, '')
        : value
    const sameTarget = existingData.result?.find(
      (existing: { id: string; content: string; priority?: number }) =>
        normalizeContent(existing.content) === normalizeContent(record.content)
    )
    const otherMxRecords = record.type === 'MX'
      ? (existingData.result || []).filter(
          (existing: { content: string }) =>
            normalizeContent(existing.content) !== normalizeContent(record.content)
        )
      : []

    if (options.replaceConflictingInboundMx) {
      const blockingRecord = otherMxRecords.find(
        (existing: { content: string }) =>
          !isReplaceableInboundMxConflict(existing.content)
      )
      if (blockingRecord) {
        throw new Error(
          `Cannot replace existing MX record ${blockingRecord.content}. Use a separate inbound subdomain.`
        )
      }
    }

    if (sameTarget) {
      const priorityMatches = record.type !== 'MX' || sameTarget.priority === record.priority
      if (priorityMatches) {
        results.push({ skipped: true, name: record.name, type: record.type })
      } else {
        const updateRes = await fetchCloudflare(`${CF_API_BASE}/zones/${zoneId}/dns_records/${sameTarget.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ priority: record.priority })
        })
        const updateData = await updateRes.json()
        if (!updateRes.ok || !updateData.success) {
          recordSucceeded = false
          results.push({ error: true, name: record.name, type: record.type, details: updateData.errors })
        } else {
          results.push(updateData)
        }
      }
    } else {
      const createRes = await fetchCloudflare(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          ttl: record.ttl || 1, // 1 es automático en CF
          proxied: record.proxied || false,
          priority: record.priority
        })
      })
      const createData = await createRes.json()
      if (!createRes.ok || !createData.success) {
        recordSucceeded = false
        console.error('Cloudflare Error adding record:', record.name, createData.errors)
        results.push({ error: true, name: record.name, type: record.type, details: createData.errors })
      } else {
        results.push(createData)
      }
    }

    if (
      options.replaceConflictingInboundMx &&
      recordSucceeded
    ) {
      for (const existing of otherMxRecords) {
        const deleteRes = await fetchCloudflare(
          `${CF_API_BASE}/zones/${zoneId}/dns_records/${existing.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        )
        const deleteData = await deleteRes.json()
        if (!deleteRes.ok || !deleteData.success) {
          recordSucceeded = false
          results.push({
            error: true,
            name: record.name,
            type: record.type,
            details: deleteData.errors
          })
        } else {
          results.push({
            deleted: true,
            name: record.name,
            type: record.type,
            previousContent: existing.content
          })
        }
      }
    }
  }

  return results
}
