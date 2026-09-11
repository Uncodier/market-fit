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
  // Extraer el root domain asumiendo formato común (ej. de app.domain.com -> domain.com)
  // Cloudflare API es flexible y podemos buscar con ?name=domain.com
  const domainParts = domain.split('.')
  let searchName = domain
  if (domainParts.length > 2) {
    searchName = domainParts.slice(-2).join('.') // Intento básico de root domain
  }

  // Buscar zona principal
  let res = await fetch(`${CF_API_BASE}/zones?name=${searchName}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  let data = await res.json()

  // Si no la encuentra y el original tenía más partes, intentamos buscar el original exacto por si es un subdominio registrado como zona aparte.
  if ((!data.result || data.result.length === 0) && searchName !== domain) {
    res = await fetch(`${CF_API_BASE}/zones?name=${domain}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    data = await res.json()
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
      results.push(createData)
    } else {
      // Ya existe, se podría hacer update o simplemente ignorar. Para sync ignoramos si ya existe.
      results.push({ skipped: true, name: record.name, type: record.type })
    }
  }

  return results
}
