import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/app/types";
import type { CatalogListParams, CatalogListResponse } from "./types";
import { attachCatalogRelationSummaries } from "./relation-summaries";

// POS requests 500 and existing pickers request 1000. Only the catalog page
// always requests 50; lowering this shared ceiling would silently truncate them.
const MAX_PAGE_SIZE = 1000;

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isSafeInteger(value) && value! > 0 ? value! : fallback;
}

export async function readCatalogItems({
  siteId, kind = 'all', q = '', status = 'active',
  availabilityStatus = 'all', page = 1, pageSize = 50, sortBy,
  isPosAvailable, isRecurring, isReservation,
}: CatalogListParams): Promise<CatalogListResponse> {
  const size = Math.min(positiveInteger(pageSize, 50), MAX_PAGE_SIZE);
  const from = (positiveInteger(page, 1) - 1) * size;
  if (!Number.isSafeInteger(from + size - 1)) {
    return { data: [], count: 0, error: "Invalid catalog page" };
  }

  try {
    // Keep the authenticated user client: site_id is a filter, not authorization.
    const supabase = await createClient();
    let query = supabase.from("catalog_items")
      .select("*, parent:parent_id(name)", { count: "exact" })
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
    if (q.trim()) {
      // Quote PostgREST operands so commas/parentheses cannot add filter clauses.
      // Escape LIKE metacharacters so name/SKU search remains a literal substring.
      const escaped = q.trim().replace(/[\\%_]/g, '\\$&');
      const pattern = JSON.stringify(`%${escaped}%`);
      query = query.or(`name.ilike.${pattern},sku.ilike.${pattern}`);
    }

    const { data, count, error } = await query.range(from, from + size - 1);
    if (error) return { data: [], count: 0, error: "Failed to load catalog items" };
    const withRelations = await attachCatalogRelationSummaries((data || []) as CatalogItem[]);
    return { data: withRelations, count: count ?? 0 };
  } catch {
    return { data: [], count: 0, error: "Failed to load catalog items" };
  }
}