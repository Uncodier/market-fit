import type { SupabaseClient } from "@supabase/supabase-js"
import { loadShopRequiredModifierIds } from "@/app/shop/[siteSlug]/shop-required-modifiers"

type Link = {
  catalog_item_id: string
  modifier_group: { min_select: number; site_id: string } | { min_select: number; site_id: string }[] | null
}

function reader(data: Link[] | null, error: { message: string } | null = null) {
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data, error }),
  }
  const from = jest.fn(() => query)
  return { supabase: { from } as unknown as Pick<SupabaseClient, "from">, from, query }
}

function link(host: string, minSelect: number, siteId = "site"): Link {
  return { catalog_item_id: host, modifier_group: { min_select: minSelect, site_id: siteId } }
}

it("loads required flags in one site-scoped query without exposing modifier data", async () => {
  const { supabase, from, query } = reader([link("required", 1), link("optional", 0), link("required", 0)])
  const result = await loadShopRequiredModifierIds(supabase, "site", [{ id: "required" }, { id: "optional" }, { id: "simple" }])
  expect([...result]).toEqual(["required"])
  expect(from).toHaveBeenCalledTimes(1)
  expect(from).toHaveBeenCalledWith("catalog_item_modifier_groups")
  expect(query.eq).toHaveBeenCalledWith("site_id", "site")
  expect(query.in).toHaveBeenCalledWith("catalog_item_id", ["required", "optional", "simple"])
  expect(query.select).toHaveBeenCalledWith("catalog_item_id, modifier_group:modifier_groups(min_select, site_id)")
})

it("inherits parent requirements only when the child has no own groups", async () => {
  const { supabase, query } = reader([link("parent", 1), link("override", 0), link("own-required", 2)])
  const result = await loadShopRequiredModifierIds(supabase, "site", [
    { id: "inherited", parent_id: "parent" },
    { id: "override", parent_id: "parent" },
    { id: "own-required", parent_id: "parent" },
  ])
  expect([...result]).toEqual(["inherited", "own-required"])
  expect(query.in).toHaveBeenCalledWith("catalog_item_id", ["inherited", "parent", "override", "own-required"])
})

it("normalizes joined groups and ignores missing or cross-site groups", async () => {
  const { supabase } = reader([
    { catalog_item_id: "array", modifier_group: [{ min_select: 1, site_id: "site" }] },
    { catalog_item_id: "missing", modifier_group: null },
    link("foreign", 1, "other-site"),
  ])
  expect([...await loadShopRequiredModifierIds(supabase, "site", [{ id: "array" }, { id: "missing" }, { id: "foreign" }])]).toEqual(["array"])
})

it("routes all affected items to configuration when requirements cannot be read", async () => {
  const { supabase } = reader(null, { message: "Unavailable" })
  expect([...await loadShopRequiredModifierIds(supabase, "site", [{ id: "first" }, { id: "second" }])]).toEqual(["first", "second"])
})

it("skips database work for an empty catalog page", async () => {
  const { supabase, from } = reader([])
  expect(await loadShopRequiredModifierIds(supabase, "site", [])).toEqual(new Set())
  expect(from).not.toHaveBeenCalled()
})