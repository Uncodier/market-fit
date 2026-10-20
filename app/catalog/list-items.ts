import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/app/types";
import type { CatalogListParams, CatalogListResponse } from "./types";
import { attachCatalogRelationSummaries } from "./relation-summaries";
import { CatalogSearchError, searchCatalogWindow } from "@/lib/catalog-search/server";
import { orderCatalogSearchRows } from "@/lib/catalog-search/types";

// POS requests 500 and existing pickers request 1000. Only the catalog page
// always requests 50; lowering this shared ceiling would silently truncate them.
const MAX_PAGE_SIZE = 1000;

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

export async function readCatalogItems({
  siteId, kind = 'all', q = '', status = 'active', search_id,
  availabilityStatus = 'all', page = 1, pageSize = 50, sortBy,
  isPosAvailable, isRecurring, isReservation, digitalSubtype, isMarketplaceListed,
}: CatalogListParams): Promise<CatalogListResponse> {
  const size = Math.min(positiveInteger(pageSize, 50), MAX_PAGE_SIZE);
  const from = (positiveInteger(page, 1) - 1) * size;
  if (!Number.isSafeInteger(from + size - 1)) {
    return { data: [], count: 0, error: "Invalid catalog page" };
  }

  try {
    const search = q.trim() ? await searchCatalogWindow({
      query: q, channel: "catalog", site_id: siteId, search_id,
      filters: {
        kind: kind === "all" ? undefined : kind,
        parent_id: kind !== "all" && kind !== "variant" ? null : undefined,
        status: status === "all" ? undefined : status,
        availability_status: availabilityStatus === "all" ? undefined : availabilityStatus,
        is_pos_available: isPosAvailable, is_recurring: isRecurring, is_reservation: isReservation,
        digital_subtype: digitalSubtype === "all" ? undefined : digitalSubtype,
        is_marketplace_listed: isMarketplaceListed,
      },
    }) : null;
    const searchMetadata = search ? { count_kind: search.count_kind, mode: search.mode,
      degraded: search.degraded, search_id: search.search_id } : {};
    if (search && !search.items.length) return { data: [], count: 0, has_more: false, ...searchMetadata };
    // Keep the authenticated user client: site_id is a filter, not authorization.
    const supabase = await createClient();
    const buildQuery = (columns: string) => {
      let query = supabase.from("catalog_items")
        .select(columns, { count: "exact" })
        .eq("site_id", siteId);

      if (sortBy === 'newest' || sortBy === 'oldest') {
        query = query.order("created_at", { ascending: sortBy === 'oldest' });
      } else if (sortBy === 'updated_at') {
        query = query.order("updated_at", { ascending: false });
      } else {
        query = query.order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
      }
      query = query.order("id", { ascending: true });

      if (kind === 'variant') {
        query = query.not('parent_id', 'is', null);
      } else if (kind !== 'all') {
        query = query.eq('kind', kind).is('parent_id', null);
      }
      if (status !== 'all') query = query.eq('status', status);
      if (availabilityStatus !== 'all') query = query.eq('availability_status', availabilityStatus);
      if (isPosAvailable !== undefined) query = query.eq('is_pos_available', isPosAvailable);
      if (isRecurring !== undefined) query = query.eq('is_recurring', isRecurring);
      if (isReservation !== undefined) query = query.eq('is_reservation', isReservation);
      if (digitalSubtype && digitalSubtype !== 'all') query = query.eq('digital_subtype', digitalSubtype);
      if (isMarketplaceListed !== undefined) query = query.eq('is_marketplace_listed', isMarketplaceListed);
      return query;
    };
    let query = buildQuery(search ? "id, site_id" : "*, parent:parent_id(name)");
    if (search) query = query.in('id', search.items.map(item => item.id));

    const { data, count, error } = await query.range(search ? 0 : from, search ? 199 : from + size - 1);
    if (error) return { data: [], count: 0, error: "Failed to load catalog items" };
    if (search) {
      const ranked = orderCatalogSearchRows(search.items, (data || []) as Array<{ id: string; site_id: string }>);
      const pageIds = ranked.slice(from, from + size);
      const hydrated = pageIds.length ? await buildQuery("*, parent:parent_id(name)")
        .in("id", pageIds.map(item => item.id)).range(0, size - 1) : { data: [], error: null };
      if (hydrated.error) return { data: [], count: 0, error: "Failed to load catalog items" };
      const page = await attachCatalogRelationSummaries(orderCatalogSearchRows(pageIds, (hydrated.data || []) as CatalogItem[]));
      return { data: page, count: ranked.length, has_more: from + size < ranked.length, ...searchMetadata };
    }
    const withRelations = await attachCatalogRelationSummaries((data || []) as CatalogItem[]);
    return { data: withRelations, count: count ?? 0 };
  } catch (error) {
    return { data: [], count: 0, error: "Failed to load catalog items",
      ...(error instanceof CatalogSearchError ? { error_status: error.status } : {}) };
  }
}