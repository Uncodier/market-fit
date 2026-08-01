import { bookWithEntitlement } from "../../app/commerce/redeem-reservation";
import { assertReservationSlot } from "../../app/reservations/availability";

jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("../../app/reservations/availability", () => ({
  assertReservationSlot: jest.fn()
}));

const mockSupabaseClient = {
  from: jest.fn(),
};

describe("Redeem Reservation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { createClient } = require("../../lib/supabase/server");
    createClient.mockResolvedValue(mockSupabaseClient);
  });

  const setupMockQuery = (returns: any) => {
    const mockEq = jest.fn();
    const mockSingle = jest.fn().mockResolvedValue(returns);
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockInsert = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
    return { mockSingle, mockEq };
  };

  it("should fail if entitlement is not active", async () => {
    setupMockQuery({
      data: {
        id: "ent-1",
        status: "used",
        catalog_item: { kind: "digital_asset", digital_subtype: "pass" }
      },
      error: null
    });

    await expect(
      bookWithEntitlement({
        entitlementId: "ent-1",
        reservableCatalogItemId: "cat-res-1",
        startIso: "2026-08-01T10:00:00Z",
        endIso: "2026-08-01T11:00:00Z",
        quantity: 1
      })
    ).rejects.toThrow("Cannot book using a used entitlement.");
  });

  it("should fail if not enough uses", async () => {
    setupMockQuery({
      data: {
        id: "ent-1",
        status: "active",
        uses_remaining: 0,
        catalog_item: { kind: "digital_asset", digital_subtype: "pass" }
      },
      error: null
    });

    await expect(
      bookWithEntitlement({
        entitlementId: "ent-1",
        reservableCatalogItemId: "cat-res-1",
        startIso: "2026-08-01T10:00:00Z",
        endIso: "2026-08-01T11:00:00Z",
        quantity: 1
      })
    ).rejects.toThrow("Not enough uses remaining on this pass (has 0, requested 1).");
  });
});
