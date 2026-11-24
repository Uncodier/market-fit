"use client"

import { useEffect, useState } from "react"
import type { ControllerRenderProps } from "react-hook-form"
import { listCatalogCategories, listCatalogItems } from "@/app/catalog/actions"
import { Button } from "../ui/button"
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "../ui/form"
import type { SiteFormValues } from "./form-schema"

type Destination = "item" | "category"
type Option = { id: string; name: string; value: string }

/** Mounted only for this site's visible destination field; the parent form owns the draft. */
export function ShopHeroDestinationSelect({ siteId, type, field }: {
  siteId?: string; type: Destination; field: ControllerRenderProps<SiteFormValues, 'shop.hero_cta_destination_value'>
}) {
  const [options, setOptions] = useState<Option[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!siteId) return
    let current = true
    const load = async () => {
      if (type === "category") {
        const result = await listCatalogCategories(siteId)
        if (result.error) throw new Error()
        return result.data.map(({ id, name }) => ({ id, name, value: name }))
      }
      const result = await listCatalogItems({ siteId, pageSize: 1000 })
      if (result.error) throw new Error()
      return result.data.filter(item => !item.parent_id && item.is_marketplace_listed)
        .map(({ id, name }) => ({ id, name, value: id }))
    }
    void load().then(rows => { if (current) setOptions(rows) }, () => { if (current) setFailed(true) })
    return () => { current = false }
  }, [siteId, type, revision])

  const label = type === "category" ? "Select Category" : "Select Item"
  const placeholder = type === "category" ? "Select a category..." : "Select an item..."
  const value = field.value || ""
  return <FormItem>
    <FormLabel>{label}</FormLabel>
    <FormControl>
      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 disabled:opacity-50"
        {...field} value={value} disabled={!options || field.disabled} aria-busy={Boolean(siteId && !options && !failed)}>
        <option value="" disabled>{placeholder}</option>
        {value && !options?.some(option => option.value === value) && <option value={value} disabled>{value}</option>}
        {options?.map(option => <option key={option.id} value={option.value}>{option.name}</option>)}
      </select>
    </FormControl>
    {failed && <p role="alert" className="text-sm text-destructive">Could not load the destination options.{' '}
      <Button type="button" size="sm" variant="ghost" onClick={() => { setFailed(false); setRevision(current => current + 1) }}>Retry</Button>
    </p>}
    <FormDescription>{type === "category" ? "Select the category to filter by." : "Select the item to open."}</FormDescription>
    <FormMessage />
  </FormItem>
}