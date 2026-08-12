import {
  DEFAULT_PRICE_LIST_CHANNELS,
  isPriceListAllowedForChannel,
  normalizePriceListChannels,
  toPriceListChannel,
} from "@/app/price-lists/price-list-channels";

describe("price-list-channels", () => {
  it("defaults missing channels to POS only", () => {
    expect(normalizePriceListChannels(null)).toEqual(
      DEFAULT_PRICE_LIST_CHANNELS
    );
    expect(normalizePriceListChannels([])).toEqual(["pos"]);
  });

  it("maps storefront sources to channels", () => {
    expect(toPriceListChannel("shop")).toBe("shop");
    expect(toPriceListChannel("marketplace")).toBe("marketplace");
    expect(toPriceListChannel("pos")).toBe("pos");
    expect(toPriceListChannel("sales")).toBeNull();
  });

  it("allows internal sources without channel restriction", () => {
    expect(isPriceListAllowedForChannel(["pos"], "sales")).toBe(true);
    expect(isPriceListAllowedForChannel(["pos"], "quote")).toBe(true);
  });

  it("gates storefront sources by list channels", () => {
    expect(isPriceListAllowedForChannel(["pos"], "shop")).toBe(false);
    expect(isPriceListAllowedForChannel(["pos", "shop"], "shop")).toBe(true);
    expect(isPriceListAllowedForChannel(["marketplace"], "marketplace")).toBe(
      true
    );
  });
});
