import {
  clearReservationSlotsInflight,
  getReservationSlotsLocalFirst,
  reservationSlotsRequestKey,
} from "@/app/pos/local/reservation-slots";

const slotsStore = new Map<string, any>();
const getAvailableSlots = jest.fn();

jest.mock("@/app/pos/local/db", () => ({
  getPosDb: () => ({
    reservationSlots: {
      get: async (id: string) => slotsStore.get(id),
      put: async (row: { id: string }) => {
        slotsStore.set(row.id, row);
      },
      delete: async (id: string) => {
        slotsStore.delete(id);
      },
    },
  }),
}));

jest.mock("@/app/reservations/availability", () => ({
  getAvailableSlots: (...args: unknown[]) => getAvailableSlots(...args),
}));

describe("getReservationSlotsLocalFirst", () => {
  beforeEach(() => {
    slotsStore.clear();
    clearReservationSlotsInflight();
    getAvailableSlots.mockReset();
  });

  it("builds a stable request key", () => {
    expect(
      reservationSlotsRequestKey({
        catalogItemId: "item-1",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        qty: 2,
      }),
    ).toBe("item-1:2026-08-01:2026-08-31:2:");
  });

  it("returns cached slots without hitting the network", async () => {
    slotsStore.set("item-1:2026-08-01:2026-08-31", {
      id: "item-1:2026-08-01:2026-08-31",
      catalogItemId: "item-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      slots: [{ start: "a", end: "b", available: 1 }],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    const first = await getReservationSlotsLocalFirst({
      catalogItemId: "item-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    const second = await getReservationSlotsLocalFirst({
      catalogItemId: "item-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    expect(first.fromCache).toBe(true);
    expect(second.fromCache).toBe(true);
    expect(getAvailableSlots).not.toHaveBeenCalled();
  });

  it("coalesces concurrent fetches so a remount does not start a second request", async () => {
    let resolveSlots: (value: unknown[]) => void = () => {};
    getAvailableSlots.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlots = resolve;
        }),
    );

    const a = getReservationSlotsLocalFirst({
      catalogItemId: "item-2",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    const b = getReservationSlotsLocalFirst({
      catalogItemId: "item-2",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });

    for (let i = 0; i < 20 && getAvailableSlots.mock.calls.length === 0; i++) {
      await Promise.resolve();
    }

    expect(getAvailableSlots).toHaveBeenCalledTimes(1);
    resolveSlots([{ start: "a", end: "b", available: 2 }]);

    const [first, second] = await Promise.all([a, b]);
    expect(first.slots).toHaveLength(1);
    expect(second.slots).toHaveLength(1);
    expect(getAvailableSlots).toHaveBeenCalledTimes(1);
  });
});
