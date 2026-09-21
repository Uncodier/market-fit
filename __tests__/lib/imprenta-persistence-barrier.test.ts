import { ImprentaPersistenceBarrier } from "@/app/lib/imprenta-persistence-barrier"

describe("ImprentaPersistenceBarrier", () => {
  it("waits for pending node saves", async () => {
    const barrier = new ImprentaPersistenceBarrier()
    let finishSave: ((value: { error: null }) => void) | undefined
    const save = new Promise<{ error: null }>((resolve) => {
      finishSave = resolve
    })
    barrier.track("node-1", save)

    let released = false
    const waiting = barrier.wait("node-1").then(() => {
      released = true
    })
    await Promise.resolve()
    expect(released).toBe(false)

    finishSave?.({ error: null })
    await waiting
    expect(released).toBe(true)
  })

  it("blocks execution after a failed save", async () => {
    const barrier = new ImprentaPersistenceBarrier()
    await barrier.track("node-1", Promise.resolve({
      error: new Error("Save failed"),
    }), "prompt")

    await expect(barrier.wait("node-1")).rejects.toThrow("Save failed")

    await barrier.track("node-1", Promise.resolve({ error: null }), "settings")
    await expect(barrier.wait("node-1")).rejects.toThrow("Save failed")

    await barrier.track("node-1", Promise.resolve({ error: null }), "prompt")
    await expect(barrier.wait("node-1")).resolves.toBeUndefined()
  })
})
