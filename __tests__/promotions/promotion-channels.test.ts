import {
  assertPromotionChannelAccess,
  isPromotionAllowedForChannel,
  isPromotionAllowedForLocation,
  normalizePromotionChannels,
} from "../../app/promotions/promotion-channels";

describe("promotion channels", () => {
  it("defaults empty channels to all storefront channels", () => {
    expect(normalizePromotionChannels([])).toEqual(["marketplace", "shop", "pos"]);
    expect(normalizePromotionChannels(null)).toEqual(["marketplace", "shop", "pos"]);
  });

  it("allows marketplace/shop/pos only when selected", () => {
    expect(isPromotionAllowedForChannel(["shop"], "shop")).toBe(true);
    expect(isPromotionAllowedForChannel(["shop"], "marketplace")).toBe(false);
    expect(isPromotionAllowedForChannel(["pos"], "pos")).toBe(true);
  });

  it("does not restrict internal sales/quote sources", () => {
    expect(isPromotionAllowedForChannel(["shop"], "sales")).toBe(true);
    expect(isPromotionAllowedForChannel(["marketplace"], "quote")).toBe(true);
  });

  it("restricts POS by location when location_ids are set", () => {
    expect(
      isPromotionAllowedForLocation(["pos"], ["loc-a"], "pos", "loc-a")
    ).toBe(true);
    expect(
      isPromotionAllowedForLocation(["pos"], ["loc-a"], "pos", "loc-b")
    ).toBe(false);
    expect(
      isPromotionAllowedForLocation(["pos"], [], "pos", "loc-b")
    ).toBe(true);
  });

  it("returns a clear error message for channel/location mismatches", () => {
    expect(
      assertPromotionChannelAccess({
        channels: ["shop"],
        source: "marketplace",
      })
    ).toBe("This promotion is not available on this channel");

    expect(
      assertPromotionChannelAccess({
        channels: ["pos"],
        locationIds: ["loc-a"],
        source: "pos",
        locationId: "loc-b",
      })
    ).toBe("This promotion is not available at this location");
  });
});
