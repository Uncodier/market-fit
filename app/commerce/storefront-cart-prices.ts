"use server"

import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/server"
import { applyChannelPricesToItems } from "@/app/price-lists/apply-channel-prices"
import { applyBuyerPricesToItems } from "@/app/price-lists/buyer-prices"
import { applyStorefrontAvailability } from "@/app/catalog/storefront-availability"
import { getUsdFxRates } from "@/app/lib/fx-rates"
import { normalizeCheckoutLinesToCurrency, resolveCheckoutOrderCurrency } from "./checkout-currency"

const inputSchema = z.object({
  channel: z.enum(["shop", "marketplace"]),
  ids: z.array(z.string().uuid()).max(200),
  modifierIds: z.array(z.string().uuid()).max(200).default([]),
})
type PriceRow = { id: string; site_id: string; target_sale_price: number | null; currency: string | null;
  parent_id?: string | null; is_marketplace_listed?: boolean; is_dynamic_price?: boolean }
type ModifierLink = { catalog_item_id: string; site_id: string; modifier_group_id: string }
const columns = "id, site_id, target_sale_price, currency, parent_id, is_marketplace_listed, is_dynamic_price, site:sites!inner(id)"

/** Public hosts and their attached options only. Never accept stored prices or buyer identity. */
export async function getStorefrontCartPrices(input: z.infer<typeof inputSchema>) {
  const { channel, ids, modifierIds } = inputSchema.parse(input)
  if (!ids.length) return { items: [], rates: {} }
  const client = await createServiceClient(true, { access: "public" })
  const read = async (itemIds: string[]) => {
    if (!itemIds.length) return [] as PriceRow[]
    const { data, error } = await applyStorefrontAvailability(client.from("catalog_items")
      .select(columns).eq("status", "active").is("site.archived_at", null).in("id", itemIds))
    if (error) throw new Error("Unable to refresh cart prices")
    return (data || []) as unknown as PriceRow[]
  }
  const rows = await read([...new Set(ids)])
  const parents = await read([...new Set(rows.flatMap(row => row.parent_id ? [row.parent_id] : []))])
  const hosts = rows.filter(row => {
    const parent = parents.find(candidate => candidate.id === row.parent_id && candidate.site_id === row.site_id)
    if (row.parent_id && !parent) return false
    return row.is_marketplace_listed || parent?.is_marketplace_listed
  })
  const hostIds = [...new Set(hosts.flatMap(host => [host.id, ...(host.parent_id ? [host.parent_id] : [])]))]
  const links = hostIds.length ? await client.from("catalog_item_modifier_groups")
    .select("catalog_item_id, site_id, modifier_group_id").in("catalog_item_id", hostIds) : { data: [], error: null }
  if (links.error) throw new Error("Unable to refresh product options")
  const validLinks = ((links.data || []) as ModifierLink[]).filter(link => hosts.some(host =>
    host.site_id === link.site_id && (host.id === link.catalog_item_id || host.parent_id === link.catalog_item_id)))
  const groupIds = [...new Set(validLinks.map(link => link.modifier_group_id))]
  const options = groupIds.length && modifierIds.length ? await client.from("modifier_group_items")
    .select("catalog_item_id, site_id, modifier_group_id").in("modifier_group_id", groupIds)
    .in("catalog_item_id", modifierIds) : { data: [], error: null }
  if (options.error) throw new Error("Unable to refresh product options")
  const optionLinks = (options.data || []) as ModifierLink[]
  const optionRows = await read([...new Set(optionLinks.map(option => option.catalog_item_id))])
  const allowedOptions = optionRows.filter(row => optionLinks.some(option =>
    option.catalog_item_id === row.id && option.site_id === row.site_id && validLinks.some(link =>
      link.modifier_group_id === option.modifier_group_id && link.site_id === row.site_id)))
  const unique = [...new Map([...hosts, ...allowedOptions].map(row => [row.id, row])).values()]
  const defaults = await applyChannelPricesToItems(client, unique, channel)
  const [priced, fx, settings] = await Promise.all([applyBuyerPricesToItems(defaults, channel), getUsdFxRates(),
    client.from("settings").select("site_id, currency").in("site_id", [...new Set(unique.map(row => row.site_id))])])
  if (settings.error) throw new Error("Unable to refresh cart currency")
  const siteCurrencies = new Map(((settings.data || []) as { site_id: string; currency: string | null }[])
    .map(row => [row.site_id, row.currency]))
  const items = [...new Set(priced.map(row => row.site_id))].flatMap(siteId => {
    const siteRows = priced.filter(row => row.site_id === siteId)
    const target = resolveCheckoutOrderCurrency(siteRows, siteCurrencies.get(siteId))
    return siteRows.map(row => {
      const { lines: [converted] } = normalizeCheckoutLinesToCurrency([
        { currency: row.currency, unit_price: Number(row.target_sale_price || 0), subtotal: Number(row.target_sale_price || 0) },
      ], target, fx.rates)
      return { id: row.id, site_id: row.site_id, price: converted.unit_price, currency: target,
        dynamic: !!row.is_dynamic_price }
    })
  })
  return { items, rates: fx.rates }
}