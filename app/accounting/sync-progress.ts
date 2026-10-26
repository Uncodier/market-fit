export const SYNC_BATCH_SIZE = 25
export type SyncProgress = { processed: number; total: number; failed: number }

/** A timed-out mutation may still commit; never automatically retry it. */
export async function withSyncDeadline<T>(operation: Promise<T>, timeoutMs = 60_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Synchronization did not respond in time. Some entries may have been saved. Wait before retrying.')), timeoutMs)
    })])
  } finally {
    clearTimeout(timer)
  }
}