import type { PrintJob } from "./types"

export type PrintJobHandler = (job: PrintJob) => Promise<void>

const DEDUPE_KEY = "makinari-printer-dedupe"
const DEDUPE_MAX = 200

function loadDedupe(): string[] {
  if (typeof sessionStorage === "undefined") return []
  try {
    const raw = sessionStorage.getItem(DEDUPE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function saveDedupe(keys: string[]) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(DEDUPE_KEY, JSON.stringify(keys.slice(-DEDUPE_MAX)))
}

export function printDedupeKey(job: PrintJob): string | null {
  if (!job.orderId) return null
  const payload = job.payload as {
    delta?: {
      kind?: string
      adds?: { key: string; quantity: number }[]
      qtyChanges?: { key: string; from: number; to: number }[]
      voids?: { key: string }[]
    }
  }
  const delta = payload?.delta
  if (delta) {
    const sig = [
      delta.kind,
      (delta.adds || []).map((a) => `${a.key}:${a.quantity}`).join(","),
      (delta.qtyChanges || []).map((c) => `${c.key}:${c.from}:${c.to}`).join(","),
      (delta.voids || []).map((v) => v.key).join(","),
    ].join("|")
    return `${job.orderId}:${job.template}:${sig}`
  }
  return `${job.orderId}:${job.template}:${job.sentAt || ""}`
}

export function rememberPrinted(job: PrintJob): void {
  const key = printDedupeKey(job)
  if (!key) return
  const keys = loadDedupe()
  if (!keys.includes(key)) keys.push(key)
  saveDedupe(keys)
}

export function wasPrinted(job: PrintJob): boolean {
  const key = printDedupeKey(job)
  if (!key) return false
  return loadDedupe().includes(key)
}

export class PrintJobQueue {
  private queue: PrintJob[] = []
  private running = false
  private drainPromise: Promise<void> | null = null
  private handler: PrintJobHandler | null = null

  setHandler(handler: PrintJobHandler | null) {
    this.handler = handler
  }

  enqueue(job: PrintJob): boolean {
    if (wasPrinted(job)) return false
    if (
      this.queue.some(
        (j) => printDedupeKey(j) && printDedupeKey(j) === printDedupeKey(job),
      )
    ) {
      return false
    }
    this.queue.push(job)
    void this.drain()
    return true
  }

  async drain(): Promise<void> {
    if (this.drainPromise) return this.drainPromise
    this.drainPromise = this.runDrain()
    try {
      await this.drainPromise
    } finally {
      this.drainPromise = null
    }
  }

  private async runDrain(): Promise<void> {
    if (this.running) return
    this.running = true
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift()
        if (!job) break
        if (wasPrinted(job)) continue
        if (!this.handler) {
          this.queue.unshift(job)
          break
        }
        let lastError: unknown
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await this.handler(job)
            rememberPrinted(job)
            lastError = null
            break
          } catch (err) {
            lastError = err
          }
        }
        if (lastError) {
          console.warn("[printer] job failed", job.template, lastError)
        }
      }
    } finally {
      this.running = false
    }
  }
}

export const printerJobQueue = new PrintJobQueue()
