export type EntityPreviewRequest = { target: string; ids: string[]; targetCategoryId?: string }

type RelationField = { name: string; type?: string; relationTarget?: string; targetCategoryId?: string }

export function entityPreviewKey(request: { target: string; targetCategoryId?: string }, id: string): string {
  return `${request.target}${request.targetCategoryId ? `:${request.targetCategoryId}` : ""}:${id}`
}

export function fieldPreviewKey(field: RelationField | undefined, id: string): string {
  if (!field) return ""
  return entityPreviewKey({ target: field.relationTarget || "lead", targetCategoryId: field.targetCategoryId }, id)
}

export function buildPreviewRequests(fields: RelationField[], relations: Record<string, unknown>): EntityPreviewRequest[] {
  return fields.filter(field => field.type === "relation" &&
    typeof relations[field.name] === "string" && (relations[field.name] as string).trim())
    .map(field => ({
      target: field.relationTarget || "lead",
      ids: [relations[field.name] as string],
      ...(field.targetCategoryId ? { targetCategoryId: field.targetCategoryId } : {}),
    }))
}

export function mergePreviewRequests(requests: EntityPreviewRequest[]): EntityPreviewRequest[] {
  const grouped = new Map<string, EntityPreviewRequest>()
  for (const request of requests) {
    const ids = request.ids.filter(id => id.trim())
    if (!ids.length) continue
    const key = entityPreviewKey(request, "")
    const previous = grouped.get(key)
    grouped.set(key, { ...request, ids: [...new Set([...(previous?.ids || []), ...ids])] })
  }
  return [...grouped.values()]
}

// Batch at the caller, not inside the public action: each server call still
// validates its own 200 IDs/request, 50 requests and 1000 total IDs bounds.
export async function fetchPreviewBatches<T>(
  requests: EntityPreviewRequest[],
  siteId: string,
  resolveBatch: (batch: EntityPreviewRequest[], siteId: string) => Promise<Record<string, T>>,
): Promise<Record<string, T>> {
  const batches: EntityPreviewRequest[][] = []
  let batch: EntityPreviewRequest[] = []
  let count = 0
  const scopes = new Map<string, Set<string>>()
  for (const request of mergePreviewRequests(requests)) {
    for (const id of request.ids) {
      const keys = scopes.get(id) || new Set<string>()
      keys.add(entityPreviewKey(request, id))
      scopes.set(id, keys)
    }
    for (let offset = 0; offset < request.ids.length;) {
      if (batch.length === 50 || count === 1000) {
        batches.push(batch)
        batch = []
        count = 0
      }
      const ids = request.ids.slice(offset, offset + Math.min(200, 1000 - count))
      batch.push({ ...request, ids })
      count += ids.length
      offset += ids.length
    }
  }
  if (batch.length) batches.push(batch)
  const result: Record<string, T> = {}
  // Sequential requests avoid an unbounded fan-out for large graphs.
  for (const next of batches) Object.assign(result, await resolveBatch(next, siteId))
  // A raw ID may look unambiguous within a batch but collide across batches.
  for (const [id, keys] of scopes) if (keys.size > 1) delete result[id]
  return result
}