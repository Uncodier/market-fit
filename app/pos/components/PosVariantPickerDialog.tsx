"use client"

import React, { useState, useMemo, useEffect } from "react"
import { CatalogItem } from "@/app/types"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { VariantPicker } from "@/app/components/commerce/pdp/VariantPicker"
import { createClient } from "@/lib/supabase/client"

interface PosVariantPickerDialogProps {
  item: CatalogItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (childItem: CatalogItem) => void
}

export function PosVariantPickerDialog({ item, open, onOpenChange, onConfirm }: PosVariantPickerDialogProps) {
  const { t } = useLocalization()
  const [children, setChildren] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})

  const axes = item?.metadata?.variant_axes || []
  const hasVariants = axes.length > 0

  useEffect(() => {
    if (open && item && hasVariants) {
      setLoading(true)
      setSelectedOptions({})
      
      const supabase = createClient()
      supabase
        .from("catalog_items")
        .select("*")
        .eq("parent_id", item.id)
        .eq("status", "active")
        .eq("is_purchasable", true)
        .then(({ data, error }) => {
          if (data && !error) {
            setChildren(data as CatalogItem[])
          }
          setLoading(false)
        })
    }
  }, [open, item, hasVariants])

  const handleOptionSelect = (axisId: string, valueId: string) => {
    setSelectedOptions(prev => ({ ...prev, [axisId]: valueId }))
  }

  const resolvedChild = useMemo(() => {
    if (!hasVariants) return null
    if (Object.keys(selectedOptions).length !== axes.length) return null
    
    return children.find((c: CatalogItem) => {
      const childOpts = c.metadata?.option_values
      if (!childOpts) return false
      return Object.entries(selectedOptions).every(([aId, vId]) => childOpts[aId] === vId)
    }) || null
  }, [selectedOptions, hasVariants, axes.length, children])

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
