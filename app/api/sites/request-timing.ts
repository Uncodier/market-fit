type Stage = 'auth' | 'location' | 'list' | 'enrichment' | 'redis_read' | 'redis_write'

/** Fixed stage names only: never include actor IDs, cache keys or provider errors. */
export class SitesRequestTiming {
  private readonly startedAt = performance.now()
  private readonly stages = new Map<Stage, { start: number; end?: number }>()
  private timeoutStage?: Stage | 'request'

  markTimeout() {
    // Capture before aborting fetch, whose rejection may finish the stage before
    // the deadline response's microtask attaches its headers.
    this.timeoutStage = [...this.stages].find(([, value]) => value.end === undefined)?.[0] ?? 'request'
  }

  record(stage: 'redis_read' | 'redis_write', duration: number | undefined) {
    if (duration === undefined || !Number.isFinite(duration) || duration < 0) return
    const end = performance.now()
    this.stages.set(stage, { start: end - duration, end })
  }

  async measure<T>(stage: Stage, operation: () => PromiseLike<T>): Promise<T> {
    const measurement = { start: performance.now(), end: undefined as number | undefined }
    this.stages.set(stage, measurement)
    try {
      return await operation()
    } finally {
      measurement.end = performance.now()
    }
  }

  apply(headers: Headers, timedOut: boolean) {
    const now = performance.now()
    const values = [...this.stages].map(([name, value]) =>
      `${name};dur=${Math.max(0, (value.end ?? now) - value.start).toFixed(1)}`)
    values.push(`total;dur=${Math.max(0, now - this.startedAt).toFixed(1)}`)
    headers.set('Server-Timing', values.join(','))
    if (timedOut) {
      headers.set('X-Sites-Timeout-Stage', this.timeoutStage ?? 'request')
    }
  }
}