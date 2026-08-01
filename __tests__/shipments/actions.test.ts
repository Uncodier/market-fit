import {
  buildTrackingNumber,
  canRecordShipmentLocation,
} from "../../app/shipments/tracking";

describe("Shipment helpers", () => {
  describe("buildTrackingNumber", () => {
    it("generates MF-{site}-{YYYYMMDD}-{random6}", () => {
      const now = new Date("2026-08-01T12:00:00.000Z");
      const tracking = buildTrackingNumber("12345678-abcd", now, "abc123");

      expect(tracking).toBe("MF-1234-20260801-ABC123");
      const parts = tracking.split("-");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("MF");
      expect(parts[1]).toBe("1234");
      expect(parts[2]).toBe("20260801");
      expect(parts[3]).toHaveLength(6);
    });

    it("produces different values with different random parts", () => {
      const now = new Date("2026-08-01T12:00:00.000Z");
      const a = buildTrackingNumber("abcd5678", now, "aaaaaa");
      const b = buildTrackingNumber("abcd5678", now, "bbbbbb");
      expect(a).not.toBe(b);
    });
  });

  describe("canRecordShipmentLocation", () => {
    it("allows assigned courier when in_transit", () => {
      expect(
        canRecordShipmentLocation({
          assignedTo: "user-1",
          status: "in_transit",
          userId: "user-1",
        })
      ).toEqual({ ok: true });
    });

    it("rejects wrong user", () => {
      const result = canRecordShipmentLocation({
        assignedTo: "user-1",
        status: "in_transit",
        userId: "user-2",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/assigned courier/i);
      }
    });

    it("rejects when unassigned", () => {
      const result = canRecordShipmentLocation({
        assignedTo: null,
        status: "in_transit",
        userId: "user-1",
      });
      expect(result.ok).toBe(false);
    });

    it("rejects when status is not in_transit", () => {
      const result = canRecordShipmentLocation({
        assignedTo: "user-1",
        status: "shipped",
        userId: "user-1",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/in transit/i);
      }
    });
  });
});
