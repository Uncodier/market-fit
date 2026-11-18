/** Preserve card/layout identities when a recovery read repeats the same graph. */
export function reconcileSnapshot<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const byId = new Map(previous.map(row => [row.id, row]))
  const next = incoming.map(row => {
    const old = byId.get(row.id)
    return old && (old === row || JSON.stringify(old) === JSON.stringify(row)) ? old : row
  })
  return next.length === previous.length && next.every((row, index) => row === previous[index]) ? previous : next
}

/** Back off unchanged execution recovery without claiming historical runs stopped. */
export function createRecoveryCadence() {
  let interval = 15_000
  let nextAt = 0
  let fingerprint: string | undefined
  return {
    due: (now: number) => now >= nextAt,
    observe(nodes: unknown, contexts: unknown, now: number) {
      const next = JSON.stringify([nodes, contexts])
      interval = next === fingerprint ? Math.min(interval * 2, 120_000) : 15_000
      fingerprint = next
      nextAt = now + interval
    },
    reset() { interval = 15_000; nextAt = 0; fingerprint = undefined },
  }
}