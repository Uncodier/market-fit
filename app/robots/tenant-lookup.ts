export interface TenantLookupKey {
  siteId: string
  instanceId: string
  requirementIds: string[]
}

export function databaseFallbackUrl(instanceId?: string) {
  return `/applications/database?artifact=true&robotInstanceId=${encodeURIComponent(instanceId || '')}`
}

export function tenantLookupIdentity(key: TenantLookupKey) {
  return JSON.stringify([key.siteId, key.instanceId, key.requirementIds])
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Tenant lookup cancelled', 'AbortError')
}

/** An aborted signal, not the error name/message, proves owned cancellation. */
export async function lookupTenantUrl(key: TenantLookupKey, signal: AbortSignal) {
  throwIfAborted(signal)
  const results = await Promise.all(key.requirementIds.map(async (requirementId) => {
    throwIfAborted(signal)
    // The API authorizes the requirement's site; combined identifiers are rejected.
    const params = new URLSearchParams({ requirementId })
    const response = await fetch(`/api/applications/tenants?${params}`, { signal })
    throwIfAborted(signal)
    if (!response.ok) {
      throw new Error(`Tenant lookup failed (HTTP ${response.status})`)
    }
    const data: unknown = await response.json()
    throwIfAborted(signal)
    if (!data || typeof data !== 'object' || !('tenant_id' in data) || !('schema' in data)) {
      throw new Error('Invalid tenant lookup response')
    }
    if (('error' in data && data.error) || ('success' in data && data.success === false)) {
      throw new Error('Invalid tenant lookup response')
    }
    if (data.tenant_id === null && data.schema === null) return null
    if (typeof data.tenant_id !== 'string' || !data.tenant_id ||
      typeof data.schema !== 'string' || !data.schema) {
      throw new Error('Invalid tenant lookup response')
    }
    return { tenant_id: data.tenant_id, schema: data.schema }
  }))
  throwIfAborted(signal)
  // Preserve the existing last-valid, sorted requirement ID precedence.
  for (let i = results.length - 1; i >= 0; i--) {
    const tenant = results[i]
    if (tenant) {
      const params = new URLSearchParams({
        schema: tenant.schema, artifact: 'true', robotInstanceId: key.instanceId,
      })
      return `/applications/database/${encodeURIComponent(tenant.tenant_id)}?${params}`
    }
  }
  return databaseFallbackUrl(key.instanceId)
}