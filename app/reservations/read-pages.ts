export const READ_PAGE_SIZE = 500
export const READ_MAX_PAGES = 100
export const READ_TIMEOUT_MS = 15_000

export interface ReadBudget { deadline: number; pages: number }
export function createReadBudget(): ReadBudget { return { deadline: Date.now() + READ_TIMEOUT_MS, pages: 0 } }

// PostgREST builders are thenables; keep each request abortable as well as bounded.
export async function readAllPages<T>(
  query: (offset: number, signal: AbortSignal) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  budget = createReadBudget(),
): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += READ_PAGE_SIZE) {
    if (++budget.pages > READ_MAX_PAGES) throw new Error("The date window is too busy. Choose a smaller period.")
    const remaining = budget.deadline - Date.now()
    if (remaining <= 0) throw new Error("The calendar read timed out. Please retry or choose a smaller period.")
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      timer = setTimeout(() => controller.abort(), remaining)
      // Do not release the read while its transport remains pending. If a transport
      // ignores abort, waiting for settlement prevents retries overlapping that work.
      const result = await query(offset, controller.signal)
      if (controller.signal.aborted) throw new Error("The calendar read timed out. Please retry or choose a smaller period.")
      if (result.error) throw new Error("Calendar data could not be loaded. Please retry.")
      if (!Array.isArray(result.data)) throw new Error("Calendar data could not be loaded. Please retry.")
      rows.push(...result.data)
      if (result.data.length < READ_PAGE_SIZE) return rows
    } catch (error) {
      if (controller.signal.aborted) throw new Error("The calendar read timed out. Please retry or choose a smaller period.")
      throw error
    } finally { if (timer) clearTimeout(timer) }
  }
}

export async function readIdBatches<T>(
  ids: string[],
  query: (ids: string[], offset: number, signal: AbortSignal) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  budget: ReadBudget,
) {
  const rows: T[] = []
  for (let i = 0; i < ids.length; i += READ_PAGE_SIZE) {
    rows.push(...await readAllPages((offset, signal) => query(ids.slice(i, i + READ_PAGE_SIZE), offset, signal), budget))
  }
  return rows
}