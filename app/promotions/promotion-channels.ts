export const PROMOTION_CHANNELS = ["marketplace", "shop", "pos"] as const;

export type PromotionChannel = (typeof PROMOTION_CHANNELS)[number];

export const DEFAULT_PROMOTION_CHANNELS: PromotionChannel[] = [
  "marketplace",
  "shop",
  "pos",
];

export function normalizePromotionChannels(
  channels?: string[] | null
): PromotionChannel[] {
  if (!channels || channels.length === 0) return [...DEFAULT_PROMOTION_CHANNELS];
  const allowed = new Set<string>(PROMOTION_CHANNELS);
  const next = channels.filter((c): c is PromotionChannel => allowed.has(c));
  return next.length > 0 ? next : [...DEFAULT_PROMOTION_CHANNELS];
}

export function normalizePromotionLocationIds(
  locationIds?: string[] | null
): string[] {
  if (!locationIds || locationIds.length === 0) return [];
  return Array.from(new Set(locationIds.filter(Boolean)));
}

/** Map checkout/order source to a promotion channel when applicable. */
export function toPromotionChannel(
  source?: string | null
): PromotionChannel | null {
  if (source === "marketplace" || source === "shop" || source === "pos") {
    return source;
  }
  return null;
}

export function isPromotionAllowedForChannel(
  channels: string[] | null | undefined,
  source?: string | null
): boolean {
  const channel = toPromotionChannel(source);
  // Internal sources (sales/quote) are not restricted by storefront channels.
  if (!channel) return true;
  return normalizePromotionChannels(channels).includes(channel);
}

export function isPromotionAllowedForLocation(
  channels: string[] | null | undefined,
  locationIds: string[] | null | undefined,
  source?: string | null,
  locationId?: string | null
): boolean {
  const channel = toPromotionChannel(source);
  if (channel !== "pos") return true;

  const allowedChannels = normalizePromotionChannels(channels);
  if (!allowedChannels.includes("pos")) return false;

  const allowedLocations = normalizePromotionLocationIds(locationIds);
  if (allowedLocations.length === 0) return true;
  if (!locationId) return false;
  return allowedLocations.includes(locationId);
}

export function assertPromotionChannelAccess(params: {
  channels?: string[] | null;
  locationIds?: string[] | null;
  source?: string | null;
  locationId?: string | null;
}): string | null {
  const { channels, locationIds, source, locationId } = params;

  if (!isPromotionAllowedForChannel(channels, source)) {
    return "This promotion is not available on this channel";
  }

  if (!isPromotionAllowedForLocation(channels, locationIds, source, locationId)) {
    return "This promotion is not available at this location";
  }

  return null;
}
