import { z } from "zod"

export const ICP_MINING_LIST_PAGE_SIZE = 200
export const ICP_MINING_LIST_ERROR = "Unable to load this site's pending mining lists. Please try again."

const miningListSchema = z.object({
  id: z.string().uuid().transform(id => id.toLowerCase()),
  name: z.string().nullable(),
  status: z.enum(["pending", "running"]),
  total_targets: z.number().nullable(),
  processed_targets: z.number().nullable(),
  progress_percent: z.union([z.string(), z.number()]).nullable(),
})
export type IcpMiningList = z.output<typeof miningListSchema>
const pageSchema = z.object({
  lists: z.array(miningListSchema).max(ICP_MINING_LIST_PAGE_SIZE),
  next_cursor: z.string().uuid().transform(id => id.toLowerCase()).nullable(),
})

/** The authenticated site-scoped route also includes pending lists without segments. */
export async function fetchIcpMiningLists(siteId: string, signal?: AbortSignal): Promise<IcpMiningList[]> {
  if (!siteId) return []
  const lists: IcpMiningList[] = []
  let cursor: string | undefined
  while (true) {
    if (signal?.aborted) throw new DOMException("List loading cancelled", "AbortError")
    const params = new URLSearchParams({ site_id: siteId })
    if (cursor) params.set("after", cursor)
    const response = await fetch(`/api/settings/icp-mining-lists?${params}`, {
      credentials: "same-origin", cache: "no-store", signal,
    })
    if (signal?.aborted) throw new DOMException("List loading cancelled", "AbortError")
    if (!response.ok) throw new Error(ICP_MINING_LIST_ERROR)
    const parsed = pageSchema.safeParse(await response.json())
    if (!parsed.success) throw new Error(ICP_MINING_LIST_ERROR)
    const { lists: page, next_cursor: nextCursor } = parsed.data
    // The server returns a cursor for every nonempty page, including short ones.
    if (!page.length) {
      if (nextCursor !== null) throw new Error(ICP_MINING_LIST_ERROR)
      return lists
    }
    for (const list of page) {
      if (cursor && list.id <= cursor) throw new Error(ICP_MINING_LIST_ERROR)
      lists.push(list)
      cursor = list.id
    }
    if (nextCursor !== cursor) throw new Error(ICP_MINING_LIST_ERROR)
  }
}