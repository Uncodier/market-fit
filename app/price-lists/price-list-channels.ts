export const PRICE_LIST_CHANNELS = ["marketplace", "shop", "pos"] as const;

export type PriceListChannel = (typeof PRICE_LIST_CHANNELS)[number];

/** New / legacy lists default to POS until other channels are opted in. */
export const DEFAULT_PRICE_LIST_CHANNELS: PriceListChannel[] = ["pos"];

export function normalizePriceListChannels(
  channels?: string[] | null
): PriceListChannel[] {
  if (!channels || channels.length === 0) return [...DEFAULT_PRICE_LIST_CHANNELS];
  const allowed = new Set<string>(PRICE_LIST_CHANNELS);
  const next = channels.filter((c): c is PriceListChannel => allowed.has(c));
  return next.length > 0 ? next : [...DEFAULT_PRICE_LIST_CHANNELS];
}

/** Map checkout/order source to a price-list channel when applicable. */
export function toPriceListChannel(
  source?: string | null
): PriceListChannel | null {
  if (source === "marketplace" || source === "shop" || source === "pos") {
    return source;
  }
  return null;
}

export function isPriceListAllowedForChannel(
  channels: string[] | null | undefined,
  source?: string | null
): boolean {
  const channel = toPriceListChannel(source);
  // Internal sources (sales/quote) are not restricted by storefront channels.
  if (!channel) return true;
  return normalizePriceListChannels(channels).includes(channel);
}
