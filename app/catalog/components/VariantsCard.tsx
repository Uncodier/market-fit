"use client"

import React, { useState, useEffect } from "react"
import { CatalogItem, VariantAxis, VariantAxisValue, VariantAxisKind } from "@/app/types"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import { Plus, Trash2, Settings } from "@/app/components/ui/icons"
import { VARIANT_AXES_CATALOG, getSuggestedVariantAxes } from "../variant-axes"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Badge } from "@/app/components/ui/badge"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { upsertCatalogItem } from "../actions"
import { listVariantChildren, syncVariantChildren } from "../variant-actions"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"

interface VariantsCardProps {
  item: CatalogItem
  onUpdate: (updated: Partial<CatalogItem>) => void
}

export function VariantsCard({ item, onUpdate }: VariantsCardProps) {
  const { t } = useLocalization()
  const suggestedAxes = getSuggestedVariantAxes(item)

  const [axes, setAxes] = useState<VariantAxis[]>(item.metadata?.variant_axes || [])
  const [children, setChildren] = useState<CatalogItem[]>([])
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [loadingChildren, setLoadingChildren] = useState(false)

  const loadChildren = async () => {
    if (!item.id) return
    setLoadingChildren(true)
    const { data, error } = await listVariantChildren(item.id)
    if (error) toast.error(error)
    else setChildren(data || [])
    setLoadingChildren(false)
  }

  useEffect(() => {
    setAxes(item.metadata?.variant_axes || [])
  }, [item.id, item.metadata?.variant_axes])

  useEffect(() => {
    loadChildren()
  }, [item.id])

  const handleAddAxis = (kind: VariantAxisKind) => {
    const catalogDef = VARIANT_AXES_CATALOG[kind]
    if (!catalogDef) return
    if (axes.find((a) => a.kind === kind)) return
    if (axes.length >= 3) {
      toast.error(t("catalog.variants.maxAxes") || "Maximum 3 option types")
      return
    }

    setAxes([
      ...axes,
      {
        id: kind,
        kind,
        values: catalogDef.defaultValues ? [...catalogDef.defaultValues] : [],
      },
    ])
  }

  const handleRemoveAxis = (index: number) => {
    setAxes(axes.filter((_, i) => i !== index))
  }

  const handleUpdateAxisValues = (axisIndex: number, newValues: VariantAxisValue[]) => {
    setAxes(axes.map((a, i) => (i === axisIndex ? { ...a, values: newValues } : a)))
  }

  const handleSaveAxes = async () => {
    if (!item.id) return
    setSaving(true)
    try {
      const isPurchasable = axes.length === 0
      const { data, error } = await upsertCatalogItem({
        id: item.id,
        site_id: item.site_id,
        metadata: {
          ...(item.metadata || {}),
          variant_axes: axes,
        },
        is_purchasable: isPurchasable,
      })
      if (error) throw new Error(error)
      if (data) onUpdate(data)
      toast.success(t("catalog.variants.saved") || "Variant options saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateSkus = async () => {
    if (!item.id) return
    if (axes.length === 0) {
      toast.error(t("catalog.variants.addAxisFirst") || "Add at least one option type first")
      return
    }
    if (axes.some((a) => !a.values?.length)) {
      toast.error(t("catalog.variants.valuesRequired") || "Each option needs at least one value")
      return
    }

    setSyncing(true)
    try {
      // Persist axes first so sync reads current metadata
      const { error: saveError } = await upsertCatalogItem({
        id: item.id,
        site_id: item.site_id,
        metadata: {
          ...(item.metadata || {}),
          variant_axes: axes,
        },
        is_purchasable: false,
      })
      if (saveError) throw new Error(saveError)

      const { data, error } = await syncVariantChildren(item.id)
      if (error) throw new Error(error)

      setChildren(data || [])
      onUpdate({
        metadata: { ...(item.metadata || {}), variant_axes: axes },
        is_purchasable: false,
      })
      toast.success(
        `Generated ${data?.length || 0} variant SKUs`
      )
      await loadChildren()
    } catch (err: any) {
      toast.error(err.message || "Failed to generate SKUs")
    } finally {
      setSyncing(false)
    }
  }

  const handleUpdateChild = async (
    childId: string,
    patch: { sku?: string; target_sale_price?: number }
  ) => {
    const child = children.find((c) => c.id === childId)
    if (!child) return
    const { data, error } = await upsertCatalogItem({
      id: childId,
      site_id: item.site_id,
      ...patch,
    })
    if (error) {
      toast.error(error)
      return
    }
    if (data) {
      setChildren((prev) => prev.map((c) => (c.id === childId ? data : c)))
      toast.success(t("catalog.variants.childUpdated") || "Variant updated")
    }
  }

  const comboCount = axes.reduce((acc, a) => acc * Math.max(a.values?.length || 0, 1), axes.length ? 1 : 0)

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>{t("catalog.variants.title") || "Variants"}</SectionCardTitle>
          <SectionCardDescription>
            {t("catalog.variants.description") ||
              "Define options like size or color. This item becomes the presentation parent; each combination is a sellable SKU."}
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          {axes.length > 0 ? (
            <div className="space-y-6">
              {axes.map((axis, i) => (
                <AxisEditor
                  key={axis.id}
                  axis={axis}
                  onRemove={() => handleRemoveAxis(i)}
                  onUpdateValues={(vals) => handleUpdateAxisValues(i, vals)}
                />
              ))}

              {axes.length < 3 && (
                <div className="pt-4 border-t">
                  <Label className="mb-2 block">
                    {t("catalog.variants.addOption") || "Add another option"}
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(VARIANT_AXES_CATALOG)
                      .filter((k) => !axes.find((a) => a.kind === k))
                      .map((kind) => {
                        const k = kind as VariantAxisKind
                        const isSuggested = suggestedAxes.includes(k)
                        return (
                          <Button
                            key={k}
                            type="button"
                            variant={isSuggested ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => handleAddAxis(k)}
                          >
                            <Plus size={14} className="mr-1" />
                            {t(VARIANT_AXES_CATALOG[k].defaultLabelKey) || k}
                          </Button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 bg-muted/20 border-2 border-dashed rounded-md">
              <h3 className="font-medium mb-2">
                {t("catalog.variants.emptyTitle") || "This item has no variants"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("catalog.variants.emptyDescription") ||
                  "Add options like Size, Color, or Duration to sell different versions of this item."}
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {suggestedAxes.map((k) => (
                  <Button
                    key={k}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAddAxis(k)}
                  >
                    <Plus size={14} className="mr-1" />
                    {t(VARIANT_AXES_CATALOG[k].defaultLabelKey) || k}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </SectionCardContent>
        <ActionFooter>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={handleSaveAxes} disabled={saving} size="sm">
              {saving
                ? t("common.saving") || "Saving..."
                : t("catalog.variants.saveOptions") || "Save Options"}
            </Button>
            <Button
              type="button"
              onClick={handleGenerateSkus}
              disabled={syncing || axes.length === 0}
              className="gap-2"
            >
              <Settings size={16} />
              {syncing
                ? t("catalog.variants.generating") || "Generating..."
                : t("catalog.variants.generateSkus") ||
                  `Generate SKUs${comboCount ? ` (${comboCount})` : ""}`}
            </Button>
          </div>
        </ActionFooter>
      </SectionCard>

      {(children.length > 0 || loadingChildren) && (
        <SectionCard>
          <SectionCardHeader>
            <SectionCardTitle>{t("catalog.variants.skusTitle") || "Variant SKUs"}</SectionCardTitle>
            <SectionCardDescription>
              {t("catalog.variants.skusDescription") ||
                "Each row is a sellable unit with its own price and SKU."}
            </SectionCardDescription>
          </SectionCardHeader>
          <SectionCardContent>
            {loadingChildren ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center px-4 py-3 border-b">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-8 w-28" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("catalog.variants.colName") || "Name"}</TableHead>
                    <TableHead>{t("catalog.variants.colSku") || "SKU"}</TableHead>
                    <TableHead className="w-[140px]">
                      {t("catalog.variants.colPrice") || "Price"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {children.map((child) => (
                    <ChildRow key={child.id} child={child} onSave={handleUpdateChild} />
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCardContent>
        </SectionCard>
      )}
    </div>
  )
}

function ChildRow({
  child,
  onSave,
}: {
  child: CatalogItem
  onSave: (id: string, patch: { sku?: string; target_sale_price?: number }) => Promise<void>
}) {
  const [sku, setSku] = useState(child.sku || "")
  const [price, setPrice] = useState(String(child.target_sale_price ?? ""))

  useEffect(() => {
    setSku(child.sku || "")
    setPrice(String(child.target_sale_price ?? ""))
  }, [child.id, child.sku, child.target_sale_price])

  return (
    <TableRow>
      <TableCell className="font-medium text-sm">{child.name}</TableCell>
      <TableCell>
        <Input
          className="h-8 font-mono text-xs"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onBlur={() => {
            if (sku !== (child.sku || "")) onSave(child.id, { sku: sku || undefined })
          }}
          placeholder="SKU"
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8"
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => {
            const n = parseFloat(price)
            if (!Number.isNaN(n) && n !== child.target_sale_price) {
              onSave(child.id, { target_sale_price: n })
            }
          }}
        />
      </TableCell>
    </TableRow>
  )
}

function AxisEditor({
  axis,
  onRemove,
  onUpdateValues,
}: {
  axis: VariantAxis
  onRemove: () => void
  onUpdateValues: (vals: VariantAxisValue[]) => void
}) {
  const { t } = useLocalization()
  const [newValue, setNewValue] = useState("")
  const [newHex, setNewHex] = useState("#000000")
  const def = VARIANT_AXES_CATALOG[axis.kind]

  const handleAddValue = () => {
    if (!newValue.trim()) return
    const id = newValue.trim().toLowerCase().replace(/\s+/g, "-")
    if (axis.values.find((v) => v.id === id)) {
      setNewValue("")
      return
    }
    const value: VariantAxisValue = { id, label: newValue.trim() }
    if (axis.kind === "color") value.hex = newHex
    onUpdateValues([...axis.values, value])
    setNewValue("")
  }

  const handleRemoveValue = (id: string) => {
    onUpdateValues(axis.values.filter((v) => v.id !== id))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddValue()
    }
  }

  return (
    <div className="bg-background border rounded-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium capitalize flex items-center">
          {axis.label || t(def.defaultLabelKey) || axis.kind}
          <Badge variant="outline" className="ml-2 text-xs font-normal">
            {def.widget}
          </Badge>
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-destructive h-8 w-8"
        >
          <Trash2 size={16} />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {axis.values.map((v) => (
            <div
              key={v.id}
              className="flex items-center bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-sm"
            >
              {axis.kind === "color" && v.hex && (
                <div
                  className="w-3 h-3 rounded-full mr-2 border border-black/10"
                  style={{ backgroundColor: v.hex }}
                />
              )}
              {v.label}
              <button
                type="button"
                onClick={() => handleRemoveValue(v.id)}
                className="ml-2 opacity-50 hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 max-w-md items-center">
          {axis.kind === "color" && (
            <Input
              type="color"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value)}
              className="h-9 w-12 p-1 cursor-pointer"
            />
          )}
          <Input
            placeholder={`Add ${axis.kind}...`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-9"
          />
          <Button type="button" size="sm" onClick={handleAddValue} variant="secondary">
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
