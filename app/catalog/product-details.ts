import { CatalogItem, ItemSpec } from "../types";
import { isRoundRobinPass } from "@/app/commerce/pass-round-robin";

export function resolveItemSpecDisplay(item: CatalogItem, categorySlug: string): ItemSpec | undefined {
  return item.item_specs?.find(s => s.category?.slug === categorySlug);
}

export function resolveItemSpecDisplays(item: CatalogItem, categorySlug: string): ItemSpec[] {
  return item.item_specs?.filter(s => s.category?.slug === categorySlug) || [];
}

/**
 * Merge parent catalog display fields into a child (variant / reservable) item.
 * Child values win; parent fills gaps for image, description, specs, and attributes.
 */
export function mergeParentIntoCatalogItem(
  item: CatalogItem & { _shop?: any; _parent?: { id: string; name: string; image_url?: string | null } },
  parent: (CatalogItem & { item_specs?: ItemSpec[] }) | null | undefined
): CatalogItem & { _shop?: any; _parent?: { id: string; name: string; image_url?: string | null } } {
  if (!parent) return item

  const childSpecs = item.item_specs || []
  const parentSpecs = parent.item_specs || []
  const childSlugs = new Set(
    childSpecs.map((s) => s.category?.slug).filter(Boolean) as string[]
  )
  const mergedSpecs = [
    ...childSpecs,
    ...parentSpecs.filter((s) => s.category?.slug && !childSlugs.has(s.category.slug)),
  ]

  const childAttrs =
    item.metadata?.attributes && typeof item.metadata.attributes === "object"
      ? item.metadata.attributes
      : {}
  const parentAttrs =
    parent.metadata?.attributes && typeof parent.metadata.attributes === "object"
      ? parent.metadata.attributes
      : {}

  return {
    ...item,
    description: item.description || parent.description,
    image_url: item.image_url || parent.image_url,
    item_specs: mergedSpecs,
    metadata: {
      ...(parent.metadata || {}),
      ...(item.metadata || {}),
      attributes: { ...parentAttrs, ...childAttrs },
      option_values: item.metadata?.option_values,
      variant_axes: item.metadata?.variant_axes ?? parent.metadata?.variant_axes,
      gallery:
        (Array.isArray(item.metadata?.gallery) && item.metadata.gallery.length
          ? item.metadata.gallery
          : parent.metadata?.gallery) || item.metadata?.gallery,
    },
    _parent: {
      id: parent.id,
      name: parent.name,
      image_url: parent.image_url,
    },
  }
}

export function isAccessOnlyItem(item: CatalogItem) {
  if (item.is_recurring) return true
  if (isRoundRobinPass(item)) return false
  return Boolean(item.kind === 'digital_asset' && item.digital_subtype === 'pass')
}

/** Digital assets and recurring plans grant entitlements to a platform user. */
export function needsBuyerAccount(
  item: Pick<CatalogItem, "kind" | "is_recurring">,
) {
  return Boolean(item.kind === "digital_asset" || item.is_recurring)
}

export const VARIANT_SELECTION_REASON = "Item requires variant selection"

/** Parent listing that must resolve a child SKU before add-to-cart / book / buy. */
export function requiresVariantSelection(
  item: CatalogItem & { _shop?: { hasVariants?: boolean; children?: unknown[] } }
): boolean {
  if (item._shop?.hasVariants) return true
  if (item._shop?.children && item._shop.children.length > 0) return true
  return Boolean(
    item.metadata?.variant_axes?.length &&
    item.is_purchasable === false
  )
}

/** Checkout-time variant guard. Parents with purchasable children cannot be sold directly. */
export function variantSelectionBlockReason(
  item: { is_purchasable?: boolean | null; parent_id?: string | null },
  purchasableChildCount: number,
): string | null {
  if (item.is_purchasable === false) return VARIANT_SELECTION_REASON
  if (!item.parent_id && purchasableChildCount > 0) return VARIANT_SELECTION_REASON
  return null
}

/** Existing reservation lines already picked the bookable SKU (often a staff parent). */
export function shouldSkipVariantSelectionForCheckoutLine(params: {
  existingReservationId?: string | null
  reservationStart?: string | null
}) {
  return Boolean(params.existingReservationId && params.reservationStart)
}

export function hasProductDetails(item: CatalogItem): boolean {
  const m = item.metadata ?? {};
  const gallery = Array.isArray(m.gallery) ? m.gallery.filter(Boolean) : [];
  const videos = Array.isArray(m.videos) ? m.videos.filter((v: any) => v && v.url) : [];
  const hashtags = Array.isArray(m.hashtags) ? m.hashtags.filter(Boolean) : [];
  const specs = Array.isArray(m.specs) ? m.specs.filter((s: any) => s && (s.label || s.value)) : [];
  const attrs = m.attributes && typeof m.attributes === 'object' ? m.attributes : {};
  const hasAttrs = Object.values(attrs).some(v => String(v ?? '').trim());
  return Boolean(
    gallery.length ||
    videos.length ||
    hashtags.length ||
    specs.length ||
    hasAttrs
  );
}

export type AttributeField = 
  | 'duration' | 'level' | 'language' | 'event_date'
  | 'material' | 'dimensions' | 'weight' | 'warranty'
  | 'format' | 'file_size' | 'license_type' | 'seats';

export function getAttributeFieldsForItem(item: CatalogItem): AttributeField[] {
  const { kind, digital_subtype } = item;

  if (kind === 'product') {
    return ['material', 'dimensions', 'weight', 'warranty'];
  }

  if (kind === 'service') {
    return ['duration', 'level', 'language'];
  }

  if (kind === 'digital_asset') {
    if (digital_subtype === 'course') {
      return ['duration', 'level', 'language'];
    }
    if (digital_subtype === 'ticket') {
      return ['event_date', 'duration'];
    }
    if (digital_subtype === 'pass') {
      return [];
    }
    if (digital_subtype === 'file') {
      return ['format', 'file_size'];
    }
    if (digital_subtype === 'license') {
      return ['license_type', 'seats'];
    }
  }

  return [];
}

export function getListingTypeLabel(item: CatalogItem): string {
  if (item.is_recurring) return 'marketplace.listing.badge.subscription';
  if (item.kind === 'digital_asset') {
    switch (item.digital_subtype) {
      case 'course': return 'marketplace.listing.badge.course';
      case 'ticket': return 'marketplace.listing.badge.ticket';
      case 'pass': return 'marketplace.listing.badge.pass';
      case 'license': return 'marketplace.listing.badge.license';
      case 'file': return 'marketplace.listing.badge.digital';
      default: return 'marketplace.listing.badge.digital';
    }
  }
  if (item.kind === 'service') return 'marketplace.listing.badge.service';
  return 'marketplace.listing.badge.product';
}

export function getDefaultSpecCategorySlugsForItem(item: CatalogItem): string[] {
  const { kind, digital_subtype } = item;
  
  if (kind === 'product') return ['brand', 'collection'];
  if (kind === 'service') return ['instructor', 'host', 'venue'];
  
  if (kind === 'digital_asset') {
    if (digital_subtype === 'course') return ['instructor', 'author', 'collection'];
    if (digital_subtype === 'ticket') return ['event', 'artist', 'venue', 'organizer'];
    if (digital_subtype === 'pass') return ['venue', 'organizer'];
    if (digital_subtype === 'file') return ['author', 'publisher'];
    if (digital_subtype === 'license') return ['publisher'];
  }
  
  return [];
}

export function getListingMetaChips(item: CatalogItem): { labelKey?: string, value: string }[] {
  const chips: { labelKey?: string, value: string }[] = [];
  
  if (item.kind === 'digital_asset' && item.digital_subtype === 'pass') {
    if (item.pass_uses) {
      chips.push({ labelKey: 'marketplace.listing.meta.uses', value: String(item.pass_uses) });
    }
    if (item.pass_validity_days) {
      chips.push({ labelKey: 'marketplace.listing.meta.daysValid', value: String(item.pass_validity_days) });
    }
  }

  // Priority slugs for chips
  let chipSlugs: string[] = [];
  if (item.kind === 'digital_asset' && item.digital_subtype === 'ticket') chipSlugs = ['event', 'artist', 'venue'];
  else if (item.kind === 'product') chipSlugs = ['brand'];
  else if (item.kind === 'digital_asset' && item.digital_subtype === 'course') chipSlugs = ['instructor'];
  else if (item.kind === 'service') chipSlugs = ['instructor', 'venue'];
  else if (item.kind === 'digital_asset' && item.digital_subtype === 'file') chipSlugs = ['author', 'publisher'];

  const specs = item.item_specs || [];
  
  // Try to find spec-based chips first
  for (const slug of chipSlugs) {
    if (chips.length >= 2) break;
    const match = specs.find(s => s.category?.slug === slug);
    if (match?.name) {
      chips.push({ value: match.name });
    }
  }

  // If we still need chips, fallback to legacy attributes
  const legacyAttrs = (item.metadata as any)?.attributes ?? {};
  
  // Try to use legacy string attrs corresponding to the desired slugs
  for (const slug of chipSlugs) {
    if (chips.length >= 2) break;
    // Don't add if we already added a spec for this
    if (specs.some(s => s.category?.slug === slug)) continue;
    
    const val = legacyAttrs[slug];
    if (val && String(val).trim()) {
      chips.push({ value: String(val).trim() });
    }
  }

  // Finally, use any remaining valid fields
  if (chips.length < 2) {
    const fields = getAttributeFieldsForItem(item);
    for (const field of fields) {
      if (chips.length >= 2) break;
      const val = legacyAttrs[field];
      if (val && String(val).trim()) {
        chips.push({ value: String(val).trim() });
      }
    }
  }

  return chips;
}

export function getListingCtaLabel(item: CatalogItem, options?: { isOwned?: boolean, canBook?: boolean }): string {
  const isOwned = options?.isOwned || false;
  const canBook = options?.canBook || false;

  if (isOwned) {
    if (canBook) return 'marketplace.listing.cta.book';
    return 'marketplace.listing.cta.viewDetails';
  }

  if (item.is_dynamic_price) {
    const advanced = Boolean(item.metadata?.dynamic_pricing?.requires_advanced_compute)
    return advanced
      ? 'marketplace.listing.cta.requestQuote'
      : 'marketplace.listing.cta.getInstantAiQuote'
  }
  if (item.is_recurring) return 'marketplace.listing.cta.subscribe';
  if ((item.kind === 'service' || isRoundRobinPass(item)) && item.is_reservation && !isAccessOnlyItem(item)) {
    return 'marketplace.listing.cta.book';
  }
  if (item.kind === 'digital_asset') {
    switch (item.digital_subtype) {
      case 'course': return 'marketplace.listing.cta.enroll';
      case 'ticket': return 'marketplace.listing.cta.getTickets';
      case 'pass': return 'marketplace.listing.cta.buyPass';
      case 'license': return 'marketplace.listing.cta.getLicense';
      case 'file': return 'marketplace.listing.cta.getDownload';
    }
  }
  return 'marketplace.listing.cta.addToCart';
}

export function getListingPriceSuffix(item: CatalogItem): string {
  return item.is_recurring ? 'marketplace.listing.price.mo' : '';
}

export function resolveVenueLocation(item: CatalogItem) {
  const spec = resolveItemSpecDisplay(item, 'venue');
  const legacyAttrs = (item.metadata as any)?.attributes || {};

  return {
    name: spec?.name || legacyAttrs.venue,
    address: spec?.address || legacyAttrs.address,
    city: spec?.city || legacyAttrs.city,
    image_url: spec?.image_url,
  };
}

export function formatVenueAddress({ address, city }: { address?: string | null, city?: string | null }) {
  const parts = [address, city].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export function buildGoogleMapsUrl(query: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}`;
}

export function buildOpenStreetMapSearchUrl(query: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

