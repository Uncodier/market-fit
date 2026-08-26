import { createImprentaConnectionStore } from "@/app/lib/imprenta-connection-store"

describe("createImprentaConnectionStore", () => {
  it("notifies subscribers when the rubber-band endpoint moves", () => {
    const store = createImprentaConnectionStore()
    const seen: Array<{ fromNode: string; toX: number; toY: number } | null> = []
    const unsub = store.subscribe((preview) => {
      seen.push(preview)
    })

    store.set({ fromNode: "n1", toX: 10, toY: 20 })
    store.set({ fromNode: "n1", toX: 10, toY: 20 })
    store.set({ fromNode: "n1", toX: 40, toY: 80 })
    store.set(null)

    expect(seen).toEqual([
      { fromNode: "n1", toX: 10, toY: 20 },
      { fromNode: "n1", toX: 40, toY: 80 },
      null,
    ])
    unsub()
  })
})
