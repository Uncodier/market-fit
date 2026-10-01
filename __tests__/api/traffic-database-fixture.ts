import type { TrafficDatabase } from "@/lib/traffic/session-loader"
import type { TrafficSession } from "@/lib/traffic/types"

export const START = new Date("2026-09-01T00:00:00Z")
export const END = new Date("2026-09-29T23:59:59.999Z")
export const SITE = "authorized-site"
export const scope = { siteId: SITE, startDate: START, endDate: END }

type FixtureSession = TrafficSession & { site_id?: string; created_at?: string }
type Options = { cap?: number; errorAt?: number; nullAt?: number }

export function sessionId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}

export function trafficDatabase(rows: FixtureSession[] = [], options: Options = {}) {
  const queries: Array<Record<string, jest.Mock>> = []
  const from = jest.fn(() => {
    let cursor = ""
    let limit = 1000
    const filters: Array<(row: FixtureSession) => boolean> = []
    const query: Record<string, jest.Mock> = {}
    query.select = jest.fn(() => query)
    query.eq = jest.fn((column, value) => {
      if (column === "site_id") filters.push(row => (row.site_id ?? SITE) === value)
      return query
    })
    query.gte = jest.fn((_column, value) => {
      filters.push(row => (row.created_at ?? START.toISOString()) >= value)
      return query
    })
    query.lte = jest.fn((_column, value) => {
      filters.push(row => (row.created_at ?? START.toISOString()) <= value)
      return query
    })
    query.gt = jest.fn((_column, value) => { cursor = value; return query })
    query.order = jest.fn(() => query)
    query.limit = jest.fn(value => { limit = value; return query })
    const pageIndex = queries.length
    query.then = jest.fn(resolve => {
      const data = rows.filter(row => row.id > cursor && filters.every(filter => filter(row)))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, Math.min(limit, options.cap ?? 1000))
      return Promise.resolve({
        data: options.nullAt === pageIndex ? null : data,
        error: options.errorAt === pageIndex ? { message: "private database detail" } : null,
      }).then(resolve)
    })
    queries.push(query)
    return query
  })
  return { client: { from } as unknown as TrafficDatabase, from, queries }
}