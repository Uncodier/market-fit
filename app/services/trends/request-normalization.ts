import type { TrendSegment } from '@/app/types/trends'

export interface RequestSegment {
  name: string
  description?: string
}

/** Keep rich commercial context locally, but use the same bounded text as the routes. */
export function normalizeScoringSegments(segments: TrendSegment[] | undefined): TrendSegment[] {
  return (segments ?? []).flatMap(segment => {
    const [normalized] = normalizeSegments([segment], 1)
    if (!normalized) return []
    const result = { ...segment, ...normalized }
    if (normalized.description === undefined) delete result.description
    return [result]
  })
}

/** Only send the fields accepted by the provider routes. Filter before capping. */
export function normalizeSegments(segments: TrendSegment[] | undefined, max: number): RequestSegment[] {
  const normalized: RequestSegment[] = []
  for (const segment of segments ?? []) {
    const name = typeof segment.name === 'string' ? segment.name.trim().slice(0, 80) : ''
    if (!name) continue
    const description = typeof segment.description === 'string'
      ? segment.description.trim().slice(0, 240)
      : undefined
    normalized.push({ name, ...(description !== undefined ? { description } : {}) })
    if (normalized.length >= max) break
  }
  return normalized
}

export function normalizeKeywords(keywords: string[] | undefined): string[] {
  return Array.from(new Set((keywords ?? [])
    .filter(keyword => typeof keyword === 'string')
    .map(keyword => keyword.trim().slice(0, 80))
    .filter(Boolean))).slice(0, 12)
}

export function normalizeLimit(limit: number | undefined, fallback = 10): number {
  return Number.isFinite(limit) ? Math.max(1, Math.min(25, Math.trunc(limit!))) : fallback
}