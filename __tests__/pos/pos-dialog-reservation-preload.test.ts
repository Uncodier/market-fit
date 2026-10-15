import { warmSelectedReservationAvailability } from "@/app/pos/components/pos-dialog-preload"
import {
  clearReservationSlotsInflight,
  getReservationSlotsLocalFirst,
} from "@/app/pos/local/reservation-slots"
import { getAvailableSlots } from "@/app/reservations/availability"
import type { LocalReservationSlots } from "@/app/pos/local/types"

const store = new Map<string, LocalReservationSlots>()
jest.mock("@/app/pos/local/db", () => ({
  getPosDb: () => ({ reservationSlots: {
    get: async (id: string) => store.get(id),
    put: async (row: LocalReservationSlots) => { store.set(row.id, row) },
    delete: async (id: string) => { store.delete(id) },
  } }),
}))
jest.mock("@/app/reservations/availability", () => ({ getAvailableSlots: jest.fn() }))

const firstGrid = {
  catalogItemId: "service-1",
  startDate: "2026-07-26",
  endDate: "2026-09-05",
  qty: 1,
}

async function flushUntil(predicate: () => boolean) {
  for (let i = 0; i < 30 && !predicate(); i++) await Promise.resolve()
}

describe("selected POS reservation availability warming", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15, 12))
    store.clear()
    clearReservationSlotsInflight()
    jest.mocked(getAvailableSlots).mockReset().mockResolvedValue([])
  })
  afterEach(() => { jest.useRealTimers() })

  it("requests the exact initial picker grid and shares its inflight read", async () => {
    let resolveSlots!: (slots: []) => void
    jest.mocked(getAvailableSlots).mockImplementation(() => new Promise((resolve) => { resolveSlots = resolve }))
    const cancel = warmSelectedReservationAvailability("service-1")
    await flushUntil(() => jest.mocked(getAvailableSlots).mock.calls.length > 0)
    expect(getAvailableSlots).toHaveBeenCalledWith("service-1", "2026-07-26", "2026-09-05", 1, undefined)

    cancel() // Closing options must not abort the read needed by the picker.
    const pickerRead = getReservationSlotsLocalFirst(firstGrid)
    expect(getAvailableSlots).toHaveBeenCalledTimes(1)
    resolveSlots([])
    await pickerRead
    await getReservationSlotsLocalFirst(firstGrid)
    expect(getAvailableSlots).toHaveBeenCalledTimes(1)
    expect(store.has("service-1:2026-07-26:2026-09-05")).toBe(true)
  })

  it("can cancel an abandoned selection before starting the read", async () => {
    warmSelectedReservationAvailability("service-1")()
    await flushUntil(() => false)
    expect(getAvailableSlots).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it("uses the existing cache without a network request", async () => {
    store.set("service-1:2026-07-26:2026-09-05", {
      id: "service-1:2026-07-26:2026-09-05",
      ...firstGrid, slots: [], expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const cancel = warmSelectedReservationAvailability("service-1")
    await flushUntil(() => false)
    expect(getAvailableSlots).not.toHaveBeenCalled()
    cancel()
  })

  it("does not leak a rejection when the cache read fails", async () => {
    const read = jest.spyOn(store, "get").mockImplementation(() => { throw new Error("IndexedDB unavailable") })
    warmSelectedReservationAvailability("service-1")
    await flushUntil(() => false)
    expect(read).toHaveBeenCalled()
    expect(getAvailableSlots).not.toHaveBeenCalled()
    read.mockRestore()
  })
})