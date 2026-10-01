import {
  cacheOrdersDateRange,
  ordersDateRangeStorageKey,
  readOrdersDateRange,
} from "@/app/orders/date-range-cache";
import { endOfDay, startOfDay, subDays } from "date-fns";

describe("orders date range cache", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 29, 12));
  });
  afterEach(() => jest.useRealTimers());

  it("restores a saved range for the same site", () => {
    const range = {
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T23:59:59.999Z"),
    };

    cacheOrdersDateRange("site-1", range);

    expect(readOrdersDateRange("site-1")).toEqual({ ...range, preset: "custom" });
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

  it.each(["today", "last7Days", "last30Days", "last90Days"] as const)(
    "stores %s alongside its bounds and resolves it again after reload", (preset) => {
      const days = { today: 1, last7Days: 7, last30Days: 30, last90Days: 90 }[preset];
      cacheOrdersDateRange("site-1", {
        startDate: startOfDay(subDays(new Date(), days - 1)), endDate: endOfDay(new Date()), preset,
      });
      expect(JSON.parse(window.localStorage.getItem(ordersDateRangeStorageKey("site-1"))!)).toMatchObject({
        preset, startDate: expect.any(String), endDate: expect.any(String),
      });
      jest.setSystemTime(new Date(2026, 9, 1, 12));
      expect(readOrdersDateRange("site-1")).toEqual({
        startDate: startOfDay(subDays(new Date(), days - 1)), endDate: endOfDay(new Date()), preset,
      });
    },
  );

  it.each([undefined, "custom", "unknown"])("keeps legacy/custom/unknown selections fixed (%s)", (preset) => {
    const range = { startDate: startOfDay(new Date()), endDate: endOfDay(new Date()) };
    window.localStorage.setItem(ordersDateRangeStorageKey("site-1"), JSON.stringify({ ...range, preset }));
    jest.setSystemTime(new Date(2026, 9, 1, 12));
    expect(readOrdersDateRange("site-1")).toEqual({ ...range, preset: "custom" });
  });

  it.each(["{", "[]", "true", "0", '"date"', "{}", '{"startDate":null,"endDate":null}',
    '{"startDate":"2026-09-29","endDate":"2026-09-01","preset":"today"}',
  ])("ignores malformed storage: %s", (raw) => {
    window.localStorage.setItem(ordersDateRangeStorageKey("site-1"), raw);
    expect(readOrdersDateRange("site-1")).toBeUndefined();
  });

  it("handles unavailable browser storage without breaking the filter", () => {
    const get = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    expect(readOrdersDateRange("site-1")).toBeUndefined();
    get.mockRestore();
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => cacheOrdersDateRange("site-1", null)).not.toThrow();
    set.mockRestore();
    warn.mockRestore();
  });
});
