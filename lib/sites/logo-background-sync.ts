/** Called only for missing logo columns on already listed projects. The API
 * authenticates and intersects every batch with its own current membership list. */
export async function readProjectLogos(actorId: string, ids: readonly string[], signal: AbortSignal) {
  const logos: Record<string, string | null> = {}
  for (let start = 0; start < ids.length && !signal.aborted; start += 50) {
    const batch = ids.slice(start, start + 50)
    const response = await fetch('/api/sites/logos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      cache: 'no-store', body: JSON.stringify({ ids: batch }), signal,
    })
    if (!response.ok || signal.aborted) return {}
    const payload = await response.json()
    if (signal.aborted || payload?.success !== true || payload.actorId !== actorId || !payload.logos ||
        typeof payload.logos !== 'object' || Array.isArray(payload.logos)) return {}
    for (const id of batch) {
      const logo: unknown = payload.logos[id]
      if (logo !== undefined && typeof logo !== 'string') continue
      logos[id] = logo ?? null
    }
  }
  return logos
}