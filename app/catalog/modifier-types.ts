export type ModifierGroup = {
  id: string
  site_id: string
  name: string
  description?: string | null
  min_select: number
  max_select: number | null
  sort_order: number
  created_at?: string
  updated_at?: string
}

export type ModifierGroupItem = {
  id: string
  site_id: string
  modifier_group_id: string
  catalog_item_id: string
  sort_order: number
  catalog_item?: {
    id: string
    name: string
    kind?: string
    target_sale_price?: number | null
    currency?: string | null
    image_url?: string | null
    status?: string
  } | null
}

export type CatalogItemModifierGroupLink = {
  id: string
  site_id: string
  catalog_item_id: string
  modifier_group_id: string
  sort_order: number
  modifier_group?: ModifierGroup | null
}

/** Group with options — shape used by POS picker and validation. */
export type ModifierGroupWithItems = ModifierGroup & {
  items: Array<{
    id: string
    catalog_item_id: string
    sort_order: number
    name: string
    price: number
    currency?: string | null
    image_url?: string | null
    description?: string | null
    categoryName?: string | null
  }>
}

/** Context for AI placeholder images on modifier options (host / category / site). */
export type ModifierImageContext = {
  parentName?: string | null
  parentDescription?: string | null
  category?: string | null
  siteDescription?: string | null
  siteName?: string | null
}

export type ModifierSelection = {
  groupId: string
  catalogItemId: string
  quantity: number
}
