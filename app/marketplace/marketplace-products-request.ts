import { z } from "zod"
import { MARKETPLACE_SORT_VALUES } from "./marketplace-sort"
import { MARKETPLACE_SUBTYPE_VALUES } from "./marketplace-category-url"
import { marketplaceCountry } from "./marketplace-product-filters"
import { MARKETPLACE_PAGE_SIZE } from "./marketplace-pagination"

const area = z.string().trim().max(120).optional()
const price = z.coerce.number().finite().min(0).max(1000000000).optional()
const schema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(MARKETPLACE_PAGE_SIZE),
  sort: z.enum(MARKETPLACE_SORT_VALUES).default("featured"),
  kind: z.enum(["all", "product", "service", "digital_asset"]).optional(),
  digitalSubtype: z.enum(MARKETPLACE_SUBTYPE_VALUES).optional(),
  siteId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  search_id: z.string().uuid().optional(),
  is_recurring: z.enum(["true", "false"]).optional(),
  city: area,
  state: area,
  country: area,
  zip: z.string().trim().max(32).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  regionCountry: z.string().trim().min(1).max(120).refine(value => Boolean(marketplaceCountry(value))).optional(),
  nearMe: z.enum(["true", "false"]).optional(),
  minPrice: price,
  maxPrice: price,
  priceCurrency: z.string().regex(/^[A-Za-z]{3}$/).transform(value => value.toUpperCase()).optional(),
  availableOnly: z.enum(["true", "false"]).optional(),
}).refine(value => value.minPrice == null || value.maxPrice == null || value.minPrice <= value.maxPrice)
  .refine(value => !(value.regionCountry && value.nearMe === "true"))

export function parseMarketplaceProductsRequest(params: URLSearchParams) {
  const result = schema.safeParse(Object.fromEntries(params))
  if (!result.success) return null
  const { is_recurring, nearMe, availableOnly, city, state, country, zip, latitude, longitude, ...filters } = result.data
  return {
    ...filters,
    isRecurring: is_recurring === "true",
    nearMe: nearMe === "true",
    availableOnly: availableOnly === "true",
    buyerGeo: { city, state, country, zip,
      latitude: latitude === undefined ? undefined : String(latitude),
      longitude: longitude === undefined ? undefined : String(longitude) },
  }
}