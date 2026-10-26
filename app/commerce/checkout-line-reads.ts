import "server-only"
import { resolveUnitPrice } from "@/app/price-lists/actions"
import type { PriceListChannel } from "@/app/price-lists/price-list-channels"
import type { CatalogItem } from "@/app/types"
import { isAccessOnlyItem } from "@/app/catalog/product-details"
import { isRoundRobinPass } from "./pass-round-robin"
import type { CheckoutLine, CheckoutSupabaseClient } from "./checkout-types"

type CheckoutCatalogItem = Partial<CatalogItem> & {
  id: string
  parent?: { name?: string | null } | null
}

const CATALOG_FIELDS = "id, name, description, is_recurring, kind, digital_subtype, is_reservation, redeem_assignment_mode, currency, metadata, target_sale_price, parent_id, parent:parent_id(name)"
const READ_CONCURRENCY = 8
const CATALOG_CHUNK_SIZE = 100

/** Local to one checkout; never cache prices or authorization across requests. */
async function readConcurrently<T>(values: T[], read: (value: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, values.length) }, async () => {
    while (next < values.length) await read(values[next++])
  }))
}

export async function loadCheckoutCatalogItems(
  client: CheckoutSupabaseClient,
  siteId: string,
  lines: CheckoutLine[],
) {
  const items = new Map<string, CheckoutCatalogItem>()
  const ids = [...new Set(lines.flatMap((line) => [
    line.catalogItemId, ...(line.modifiers || []).map((modifier) => modifier.catalogItemId),
  ]))]
  const chunks: string[][] = []
  for (let start = 0; start < ids.length; start += CATALOG_CHUNK_SIZE) {
    chunks.push(ids.slice(start, start + CATALOG_CHUNK_SIZE))
  }
  await readConcurrently(chunks, async (chunk) => {
    const { data, error } = await client.from("catalog_items").select(CATALOG_FIELDS)
      .eq("site_id", siteId).in("id", chunk)
    if (!error && data) {
      for (const item of data as CheckoutCatalogItem[]) items.set(item.id, item)
    }
    // Recover failed/truncated batches without hiding reservation metadata. Each
    // chunk retries serially so nested fallback cannot exceed the worker limit.
    for (const id of chunk.filter((id) => !items.has(id))) {
      const { data: item } = await client.from("catalog_items").select(CATALOG_FIELDS)
        .eq("site_id", siteId).eq("id", id).single()
      if (item) items.set(id, item as CheckoutCatalogItem)
    }
  })
  return items
}

/** Batch parent modes separately so inherited reservation rules remain tenant-scoped. */
export async function loadCheckoutParentModes(
  client: CheckoutSupabaseClient,
  siteId: string,
  items: ReadonlyMap<string, CheckoutCatalogItem>,
  lines: CheckoutLine[],
) {
  const modes = new Map<string, string | null | undefined>()
  const ids = [...new Set(lines.map((line) => items.get(line.catalogItemId))
    .filter((item): item is CheckoutCatalogItem => Boolean(item?.is_reservation && item.parent_id &&
      !isAccessOnlyItem(item as CatalogItem) && !isRoundRobinPass(item)))
    .map((item) => item.parent_id!))]
  for (let start = 0; start < ids.length; start += CATALOG_CHUNK_SIZE) {
    const { data, error } = await client.from("catalog_items").select("id, redeem_assignment_mode")
      .eq("site_id", siteId).in("id", ids.slice(start, start + CATALOG_CHUNK_SIZE))
    if (!error && data) {
      for (const item of data as CheckoutCatalogItem[]) modes.set(item.id, item.redeem_assignment_mode)
    }
    await readConcurrently(ids.slice(start, start + CATALOG_CHUNK_SIZE).filter((id) => !modes.has(id)), async (id) => {
      const { data: item } = await client.from("catalog_items").select("redeem_assignment_mode")
        .eq("site_id", siteId).eq("id", id).single()
      if (item) modes.set(id, item.redeem_assignment_mode)
    })
  }
  return modes
}

export async function loadCheckoutResolvedPrices(params: {
  siteId: string
  lines: CheckoutLine[]
  finalPriceListId?: string
  isAdmin: boolean
  priceListChannel?: string | null
}) {
  const prices = new Map<string, number | { error: unknown }>()
  const ids = [...new Set(params.lines.flatMap((line) => [line, ...(line.modifiers || [])])
    .filter((line) => line.unitPriceOverride === undefined).map((line) => line.catalogItemId))]
  await readConcurrently(ids, async (id) => {
    // Keep the public resolver's client, default/explicit list, channel, and zero semantics.
    try {
      const { price } = await resolveUnitPrice(
        params.siteId, id, params.finalPriceListId, params.isAdmin, params.priceListChannel as PriceListChannel | null | undefined,
      )
      prices.set(id, price || 0)
    } catch (error) {
      // Surface failures at the original line position, after its reservation guards.
      prices.set(id, { error })
    }
  })
  return prices
}