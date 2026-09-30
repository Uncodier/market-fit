import "server-only"

import { SocialActionError } from "./social-access"

export const SOCIAL_PAGE_SIZE = 1000
export const SOCIAL_ROW_LIMIT = 20_000

type Page<T> = { data: T[] | null; error: unknown }

/**
 * Immutable descending IDs prevent refreshes of fetched_at from moving the cursor.
 * A short page is not EOF: PostgREST may impose a smaller server-side row limit.
 * Read until empty, including one probe at the 20,000-row cap. Overflow or a
 * non-progressing cursor fails the entire read; never return partial aggregates.
 */
export async function readSocialIdPages<T extends { id: string }>(
  fetchPage: (cursor: string | undefined, limit: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | undefined
  while (true) {
    const limit = Math.min(SOCIAL_PAGE_SIZE, SOCIAL_ROW_LIMIT - rows.length + 1)
    const { data, error } = await fetchPage(cursor, limit)
    if (error || (data != null && !Array.isArray(data))) throw new Error("Social page read failed")
    if (!data?.length) return rows
    if (rows.length + data.length > SOCIAL_ROW_LIMIT) {
      throw new SocialActionError("Social data exceeds the 20,000-row limit")
    }
    for (const row of data) {
      if (typeof row?.id !== "string" || !row.id || (cursor !== undefined && row.id >= cursor)) {
        throw new Error("Social page cursor did not advance")
      }
      cursor = row.id
      rows.push(row)
    }
  }
}