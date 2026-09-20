import {
  cacheOrdersDateRange,
  ordersDateRangeStorageKey,
  readOrdersDateRange,
} from "@/app/orders/date-range-cache";

describe("orders date range cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a saved range for the same site", () => {
    const range = {
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T23:59:59.999Z"),
    };

    cacheOrdersDateRange("site-1", range);

    expect(readOrdersDateRange("site-1")).toEqual(range);
    expect(readOrdersDateRange("site-2")).toBeUndefined();
  });

  it("keeps a cleared range cleared after reload", () => {
    cacheOrdersDateRange("site-1", null);

    expect(readOrdersDateRange("site-1")).toBeNull();
    expect(window.localStorage.getItem(ordersDateRangeStorageKey("site-1"))).toBe(
      "null",
    );
  });

  it("ignores invalid cached values", () => {
    window.localStorage.setItem(
      ordersDateRangeStorageKey("site-1"),
      JSON.stringify({ startDate: "invalid", endDate: "2026-09-19" }),
    );

    expect(readOrdersDateRange("site-1")).toBeUndefined();
  });
});
