"use client"

import { useEffect, useMemo, useState } from "react"
import type { CatalogItem, VariantAxis } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve"
import { getModifierGroupsForCatalogItem } from "@/app/catalog/modifier-actions"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import {
  ModifierPickerPanel,
  isModifierSelectionValid,
} from "@/app/components/commerce/ModifierPickerPanel"
import type { CartModifier } from "@/app/commerce/cart-modifiers"
import { createClient } from "@/lib/supabase/client"
import { getPosDb } from "@/app/pos/local/db"
import type { PosCartModifier } from "./CartPanel"

export type PosOptionsConfirm = {
  item: CatalogItem
  modifiers: PosCartModifier[]
}

type Props = {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (result: PosOptionsConfirm) => void
  resolvePrice: (catalogItemId: string, fallbackPrice: number) => number
  siteId?: string
  /** Dexie / snapshot cache: hostId → groups */
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>
}

function groupsFromCache(
  hostIds: string[],
  map?: Record<string, ModifierGroupWithItems[]>,
): ModifierGroupWithItems[] {
  if (!map) return []
  for (const id of hostIds) {
    if (map[id]?.length) return map[id]
  }
  return []
}

async function loadModifierGroups(
  host: CatalogItem,
  siteId: string | undefined,
  modifierGroupsByHostId?: Record<string, ModifierGroupWithItems[]>,
): Promise<ModifierGroupWithItems[]> {
  const hostIds = [host.id, host.parent_id].filter(Boolean) as string[]

  // Prefer snapshot/cache first so POS works even when server actions flake
  const fromProp = groupsFromCache(hostIds, modifierGroupsByHostId)
  if (fromProp.length) return fromProp

  const metaSiteId = siteId || host.site_id
  if (typeof window !== "undefined" && metaSiteId) {
    try {
      const meta = await getPosDb().meta.get(metaSiteId)
      const cached = groupsFromCache(
        hostIds,
        (meta as any)?.modifierGroupsByHostId,
      )
      if (cached.length) return cached
    } catch {
      // ignore
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine) {
    try {
      const { data, error } = await getModifierGroupsForCatalogItem(host.id)
      if (error) console.warn("Failed to load modifiers", error)
      if (data?.length) return data
    } catch (err) {
      console.warn("Failed to load modifiers", err)
    }
  }

  return []
}

export function PosOptionsDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  resolvePrice,
  siteId,
  modifierGroupsByHostId,
}: Props) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  const [children, setChildren] = useState<CatalogItem[]>([])
  const [axes, setAxes] = useState<VariantAxis[]>([])
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [loadingModifiers, setLoadingModifiers] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {},
  )
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupWithItems[]>(
    [],
  )
  const [selectedModifiers, setSelectedModifiers] = useState<CartModifier[]>([])

  useEffect(() => {
    if (!open || !item) return

    setSelectedOptions({})
    setSelectedModifiers([])
    setChildren([])
    setAxes([])
    setModifierGroups([])
    setLoadingVariants(true)
    setLoadingModifiers(true)

    const supabase = createClient()
    void supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", item.id)
      .eq("status", "active")
      .eq("is_purchasable", true)
      .then(({ data, error }) => {
        if (data && !error) {
          const resolved = resolveVariantAxesForDisplay(
            item,
            data as CatalogItem[],
          )
          setChildren(resolved.children)
          setAxes(resolved.axes)
        }
        setLoadingVariants(false)
      })

    void loadModifierGroups(item, siteId, modifierGroupsByHostId).then(
      (groups) => {
        setModifierGroups(groups)
        setLoadingModifiers(false)
      },
    )
  }, [open, item, siteId, modifierGroupsByHostId])

  const resolvedChild = useMemo(() => {
    if (!axes.length) return null
    if (Object.keys(selectedOptions).length !== axes.length) return null
    return (
      children.find((c) => {
        const childOpts = c.metadata?.option_values
        if (!childOpts) return false
        return Object.entries(selectedOptions).every(
          ([aId, vId]) => childOpts[aId] === vId,
        )
      }) || null
    )
  }, [selectedOptions, axes.length, children])

  const needsVariant = axes.length > 0
  const sellableItem = needsVariant ? resolvedChild : item

  const modifiersValid =
    modifierGroups.length === 0 ||
    isModifierSelectionValid(modifierGroups, selectedModifiers).ok

  const extrasTotal = useMemo(
    () =>
      selectedModifiers.reduce(
        (sum, m) => sum + Number(m.cartPrice || 0) * Number(m.cartQty || 0),
        0,
      ),
    [selectedModifiers],
  )

  const imageContext = useMemo(() => {
    if (!item) return null
    return {
      parentName: item.name,
      parentDescription: item.description,
      category:
        (item as any)._shop?.categoryName ||
        (typeof (item as any).category === "object"
          ? (item as any).category?.name
          : null) ||
        null,
      siteDescription:
        (item as any)._shop?.siteDescription ||
        (item as any).site?.description ||
        null,
      siteName: (item as any).site?.name || null,
    }
  }, [item])

  const loading = loadingVariants || loadingModifiers
  const canConfirm = !!sellableItem && modifiersValid && !loading

  const handleConfirm = () => {
    if (!sellableItem || !modifiersValid) return
    onConfirm({
      item: sellableItem,
      modifiers: selectedModifiers.map((m) => ({
        groupId: m.groupId,
        catalogItemId: m.catalogItemId,
        name: m.name,
        cartQty: m.cartQty,
        cartPrice: m.cartPrice,
      })),
    })
    onOpenChange(false)
  }

  if (!item) return null

  const currency = item.currency || "USD"
  const showModifiers = !loadingModifiers && modifierGroups.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {item.name} - {t("pos.options.title") || "Options"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {loading ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {needsVariant && (
                <div className="[&_.mb-8]:mb-0 [&_.space-y-8]:space-y-4 [&_section]:p-4 [&_section]:rounded-2xl [&_.grid]:!grid-cols-1">
                  <VariantPicker
                    axes={axes}
                    selectedOptions={selectedOptions}
                    onOptionSelect={(axisId, valueId) =>
                      setSelectedOptions((prev) => ({
                        ...prev,
                        [axisId]: valueId,
                      }))
                    }
                    childrenItems={children}
                    presentation="pdp"
                    currency={currency}
                    fallbackImageUrl={item.image_url || null}
                    imageContext={imageContext}
                  />
                </div>
              )}

              {showModifiers && (
                <div className="space-y-2">
                  {!needsVariant ? null : (
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t("pos.modifiers.title") || "Add extras"}
                    </h4>
                  )}
                  <ModifierPickerPanel
                    groups={modifierGroups}
                    value={selectedModifiers}
                    onChange={setSelectedModifiers}
                    resolvePrice={resolvePrice}
                    imageContext={imageContext}
                    currency={currency}
                  />
                </div>
              )}

              {!needsVariant && !showModifiers && (
                <p className="text-sm text-muted-foreground">
                  {t("pos.options.noChoices") || "No options for this item."}
                </p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-2">
          {showModifiers &&
            modifierGroups.every((g) => (g.min_select ?? 0) === 0) && (
              <Button
                variant="ghost"
                disabled={!sellableItem || loading}
                onClick={() => {
                  if (!sellableItem) return
                  onConfirm({ item: sellableItem, modifiers: [] })
                  onOpenChange(false)
                }}
              >
                {t("pos.modifiers.skip") || "No extras"}
              </Button>
            )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {t("common.confirm") || "Confirm"}
            {extrasTotal > 0
              ? ` (+${formatPrice(extrasTotal, currency)})`
              : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
