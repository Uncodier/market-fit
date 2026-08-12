"use client"

import React, { useState, useMemo, useEffect } from "react"
import { CatalogItem, VariantAxis } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { createClient } from "@/lib/supabase/client"
import { resolveVariantAxesForDisplay } from "@/app/catalog/variant-resolve"

interface PosVariantPickerDialogProps {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (childItem: CatalogItem) => void
}

export function PosVariantPickerDialog({ item, open, onOpenChange, onConfirm }: PosVariantPickerDialogProps) {
  const { t } = useLocalization()
  const [children, setChildren] = useState<CatalogItem[]>([])
  const [axes, setAxes] = useState<VariantAxis[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open || !item) return

    setLoading(true)
    setSelectedOptions({})
    setChildren([])
    setAxes([])

    const supabase = createClient()
    supabase
      .from("catalog_items")
      .select("*")
      .eq("parent_id", item.id)
      .eq("status", "active")
      .eq("is_purchasable", true)
      .then(({ data, error }) => {
        if (data && !error) {
          const resolved = resolveVariantAxesForDisplay(item, data as CatalogItem[])
          setChildren(resolved.children)
          setAxes(resolved.axes)
        }
        setLoading(false)
      })
  }, [open, item])

  const handleOptionSelect = (axisId: string, valueId: string) => {
    setSelectedOptions(prev => ({ ...prev, [axisId]: valueId }))
  }

  const resolvedChild = useMemo(() => {
    if (!axes.length) return null
    if (Object.keys(selectedOptions).length !== axes.length) return null

    return children.find((c: CatalogItem) => {
      const childOpts = c.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
    }) || null
  }, [selectedOptions, axes.length, children])

  const handleConfirm = () => {
    if (resolvedChild) {
      onConfirm(resolvedChild)
      onOpenChange(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{item.name} - Options</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-16" />
                  <Skeleton className="h-10 w-24" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-16" />
                </div>
              </div>
            </div>
          ) : (
            <VariantPicker
              axes={axes}
              selectedOptions={selectedOptions}
              onOptionSelect={handleOptionSelect}
              childrenItems={children}
              presentation="compact"
              currency={item.currency || "USD"}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleConfirm} disabled={!resolvedChild || loading}>
            {t("common.confirm") || "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
