import {
  PrintJobQueue,
  printDedupeKey,
  rememberPrinted,
  wasPrinted,
} from "../../../lib/printer/core/job-queue"
import type { PrintJob } from "../../../lib/printer/core/types"

function job(overrides?: Partial<PrintJob>): PrintJob {
  return {
    id: "1",
    module: "orders",
    template: "kitchen-delta",
    orderId: "ord-1",
    payload: {
      lines: [],
      delta: {
        kind: "delta",
        adds: [{ key: "fries", name: "Fries", quantity: 1 }],
        qtyChanges: [],
        voids: [],
      },
    },
    ...overrides,
  }
}

describe("print job queue", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("builds a stable dedupe key from the delta signature", () => {
    const a = printDedupeKey(job())
    const b = printDedupeKey(job({ id: "other", sentAt: "later" }))
    expect(a).toBe(b)
    expect(a).toContain("ord-1")
  })

  it("skips enqueue when the same job was already printed", () => {
    rememberPrinted(job())
    expect(wasPrinted(job())).toBe(true)
    const queue = new PrintJobQueue()
    expect(queue.enqueue(job())).toBe(false)
  })

  it("retries a failed handler then succeeds", async () => {
    const queue = new PrintJobQueue()
    let attempts = 0
    queue.setHandler(async () => {
      attempts += 1
      if (attempts === 1) throw new Error("fail once")
    })
    expect(queue.enqueue(job({ orderId: "ord-retry" }))).toBe(true)
    await queue.drain()
    expect(attempts).toBe(2)
    expect(wasPrinted(job({ orderId: "ord-retry" }))).toBe(true)
  })
})
