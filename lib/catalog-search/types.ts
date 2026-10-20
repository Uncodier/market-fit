import { z } from "zod"

export const catalogSearchFiltersSchema = z.object({
  kind: z.enum(["product", "service", "digital_asset", "variant"]).optional(),
  digital_subtype: z.string().min(1).max(80).optional(),
  category_id: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  availability_status: z.enum(["available", "unavailable", "sold_out"]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  is_reservation: z.boolean().optional(),
  is_purchasable: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  is_pos_available: z.boolean().optional(),
  is_marketplace_listed: z.boolean().optional(),
}).strict()

export const catalogSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  channel: z.enum(["shop", "marketplace", "catalog", "pos"]),
  site_id: z.string().uuid().optional(),
  filters: catalogSearchFiltersSchema.default({}),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(200).default(0),
  search_id: z.string().uuid().optional(),
}).strict().refine(value => value.channel === "marketplace" || Boolean(value.site_id))

export const catalogSearchResponseSchema = z.object({
  success: z.literal(true),
  items: z.array(z.object({ id: z.string().uuid(), site_id: z.string().uuid() })).max(100),
  count: z.number().int().min(0).max(200),
  count_kind: z.literal("candidate_window"),
  has_more: z.boolean(),
  mode: z.enum(["hybrid", "text"]),
  degraded: z.boolean(),
  search_id: z.string().uuid(),
})

export type CatalogSearchRequest = z.input<typeof catalogSearchRequestSchema>
export type CatalogSearchResult = z.output<typeof catalogSearchResponseSchema>
export type CatalogSearchFilters = z.input<typeof catalogSearchFiltersSchema>

/** Hydration is authoritative for visibility; the service owns only ordering. */
export function orderCatalogSearchRows<T extends { id: string; site_id: string }>(
  candidates: Array<{ id: string; site_id: string }>, rows: T[],
): T[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  return candidates.flatMap(candidate => {
    const row = byId.get(candidate.id)
    return row?.site_id === candidate.site_id ? [row] : []
  })
}