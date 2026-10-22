import "server-only"
import type { createClient } from "@/lib/supabase/server"

export type ReadClient = Awaited<ReturnType<typeof createClient>>
export const READ_DEADLINE_MS = 8_000

export class CommerceReadError extends Error {
  constructor(public readonly code: string, public readonly cause?: unknown) {
    super(code === "READ_TIMEOUT" ? "The request timed out. Please try again." :
      code === "READ_CHANGED" ? "Order data changed. Please refresh." :
        "Order data could not be loaded. Please try again.")
    this.name = "CommerceReadError"
  }
}

export function assertRead<T>(result: { data: T | null; error: unknown }, signal: AbortSignal): T | null {
  if (signal.aborted) throw new CommerceReadError("READ_TIMEOUT", result.error)
  if (result.error) {
    const code = typeof result.error === "object" && "code" in result.error
      ? String(result.error.code) : "READ_FAILED"
    throw new CommerceReadError(code, result.error)
  }
  return result.data
}

/** Keep the cache computation pending until every SDK request settles. */
export async function settledReads<T extends readonly unknown[]>(
  tasks: { [K in keyof T]: PromiseLike<T[K]> },
): Promise<T> {
  const results = await Promise.allSettled(tasks)
  const failure = results.find(result => result.status === "rejected")
  if (failure?.status === "rejected") throw failure.reason
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as unknown as T
}

export function uniqueIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort()
}

/** Flat scoped reads, with bounded IN lists and no silent default row-limit truncation. */
export async function readBatches<T>(
  client: ReadClient, siteId: string, table: string, select: string,
  key: string, ids: string[], signal: AbortSignal,
): Promise<T[]> {
  const chunks: string[][] = []
  const sorted = uniqueIds(ids)
  for (let start = 0; start < sorted.length; start += 100) chunks.push(sorted.slice(start, start + 100))
  const rows: T[] = []
  for (let start = 0; start < chunks.length; start += 4) {
    const group = await settledReads(chunks.slice(start, start + 4).map(async chunk => {
      const batch: T[] = []
      for (let offset = 0; ; offset += 500) {
        const result = await client.from(table).select(select).eq("site_id", siteId)
          .in(key, chunk).order("id", { ascending: true })
          .range(offset, offset + 499).abortSignal(signal)
        const page = (assertRead(result, signal) || []) as unknown as T[]
        batch.push(...page)
        if (page.length < 500) break
      }
      return batch
    }))
    rows.push(...group.flat())
  }
  return rows
}

/** Quote logic values so commas/parentheses cannot alter the PostgREST filter. */
export function searchValue(search: string): string {
  return `"%${search.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}%"`
}

export function readFailure(error: unknown) {
  const failure = error instanceof CommerceReadError ? error : new CommerceReadError("READ_FAILED", error)
  return { data: [], count: 0, error: failure.message, errorCode: failure.code }
}