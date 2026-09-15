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

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

/**
 * Searches for a zone by domain name. 
 * E.g. 'example.com' or a subdomain like 'app.example.com'.
 * In Cloudflare, a zone is typically the root domain (example.com).
 * This function tries to find the matching zone.
 */
export async function getZoneByDomain(domain: string, token: string): Promise<CloudflareZone | null> {
  // To handle complex TLDs (like .co.uk, .com.mx), fetch zones and find the best match
  // For most tokens, the number of zones is small enough that a single API call is fast
  let res = await fetch(`${CF_API_BASE}/zones?per_page=50`, {
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

  res = await fetch(`${CF_API_BASE}/zones?name=${searchName}`, {
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
    res = await fetch(`${CF_API_BASE}/zones?name=${domain}`, {
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
export async function addDnsRecords(zoneId: string, records: CloudflareDnsRecord[], token: string): Promise<any> {
  const results = []
  for (const record of records) {
    // Buscar si el registro ya existe para no duplicar (basado en nombre y tipo)
    const existingRes = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records?type=${record.type}&name=${record.name}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    const existingData = await existingRes.json()
    const exists = existingData.result && existingData.result.length > 0

    if (!exists) {
      // Crear el registro
      const createRes = await fetch(`${CF_API_BASE}/zones/${zoneId}/dns_records`, {
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
        console.error('Cloudflare Error adding record:', record.name, createData.errors)
        results.push({ error: true, name: record.name, type: record.type, details: createData.errors })
      } else {
        results.push(createData)
      }
    } else {
      // Ya existe, se podría hacer update o simplemente ignorar. Para sync ignoramos si ya existe.
      results.push({ skipped: true, name: record.name, type: record.type })
    }
  }

  return results
}
