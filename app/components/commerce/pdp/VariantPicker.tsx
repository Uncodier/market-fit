"use client"

import React from "react"
import { VariantAxis, CatalogItem } from "@/app/types"
import { getVariantWidgetForKind } from "@/app/catalog/variant-axes"
import { FALLBACK_VARIANT_AXIS_ID, shortVariantLabel } from "@/app/catalog/variant-resolve"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useDisplayCurrency } from "@/app/context/DisplayCurrencyContext"
import { optimizeForPreset, resolveItemImage } from "@/app/lib/image-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Check } from "@/app/components/ui/icons"

interface VariantPickerProps {
  axes: VariantAxis[]
  selectedOptions: Record<string, string>
  onOptionSelect: (axisId: string, valueId: string) => void
  childrenItems?: CatalogItem[]
  /** Prefer rich PDP tiles; cards use compact chips elsewhere. */
  presentation?: "pdp" | "compact"
  currency?: string
  /** Parent product image when a child SKU has no image of its own. */
  fallbackImageUrl?: string | null
  /** Extra context for AI placeholder images (parent / category / site). */
  imageContext?: {
    parentName?: string | null
    parentDescription?: string | null
    category?: string | null
    siteDescription?: string | null
  } | null
}

export function VariantPicker({
  axes,
  selectedOptions,
  onOptionSelect,
  childrenItems = [],
  presentation = "pdp",
  currency = "USD",
  fallbackImageUrl = null,
  imageContext = null,
}: VariantPickerProps) {
  const { t } = useLocalization()
  const { formatPrice } = useDisplayCurrency()

  if (!axes || axes.length === 0) return null

  const childForValue = (axisId: string, valueId: string) =>
    childrenItems.find((c) => c.metadata?.option_values?.[axisId] === valueId)

  const isValueAvailable = (axisId: string, valueId: string) => {
    if (!childrenItems || childrenItems.length === 0) return true

    const testSelection = { ...selectedOptions, [axisId]: valueId }

    return childrenItems.some((child) => {
      if (!child.metadata?.option_values) return false

      return Object.entries(testSelection).every(([aId, vId]) => {
        if (!vId) return true
        return child.metadata!.option_values![aId] === vId
      })
    })
  }

  const priceForValue = (axisId: string, valueId: string): number | null => {
    if (axes.length !== 1) return null
    const child = childForValue(axisId, valueId)
    if (!child || child.target_sale_price == null) return null
    return Number(child.target_sale_price)
  }

  const imageForValue = (axisId: string, valueId: string, label: string): string | null => {
    const child = childForValue(axisId, valueId)
    const childUrl = typeof child?.image_url === "string" ? child.image_url.trim() : ""
    if (childUrl) return optimizeForPreset(childUrl, "card")
    const promptBase = {
      image_url: null as string | null,
      parent: imageContext?.parentName
        ? {
            name: imageContext.parentName,
            description: imageContext.parentDescription,
          }
        : undefined,
      category: imageContext?.category,
      siteDescription: imageContext?.siteDescription,
    }
    // No upload: AI image for this variant (not the parent photo).
    if (child) {
      return resolveItemImage(
        {
          ...promptBase,
          name: child.name || label,
          description: child.description,
        },
        "card",
      )
    }
    const parentUrl = typeof fallbackImageUrl === "string" ? fallbackImageUrl.trim() : ""
    if (parentUrl) return optimizeForPreset(parentUrl, "card")
    return resolveItemImage(
      {
        ...promptBase,
        name: label,
      },
      "card",
    )
  }

  const resolveAxisLabel = (axis: VariantAxis) => {
    if (axis.label) return axis.label
    if (axis.id === FALLBACK_VARIANT_AXIS_ID) {
      return t("pdp.variantOption") || "Option"
    }
    const axisKindLabel = t(`catalog.variants.axis.${axis.kind}`)
    return axisKindLabel !== `catalog.variants.axis.${axis.kind}`
      ? axisKindLabel
      : axis.kind
  }

  const getDisplayLabel = (axisId: string, v: { id: string; label: string }) => {
    if (v.label && v.label.trim() !== "") return v.label
    
    const child = childForValue(axisId, v.id)
    if (child && child.name) {
      const parentName = imageContext?.parentName || ""
      if (parentName) {
        return shortVariantLabel(parentName, child.name)
      }
      return child.name
    }
    
    return v.id
  }

  const useOptionTiles =
    presentation === "pdp" &&
    axes.length === 1 &&
    (getVariantWidgetForKind(axes[0].kind) === "chips" ||
      getVariantWidgetForKind(axes[0].kind) === "radio" ||
      axes[0].kind === "custom")

  if (presentation === "compact") {
    return (
      <div className="space-y-4">
        {axes.map((axis) => {
        const widget = getVariantWidgetForKind(axis.kind)
        const label = resolveAxisLabel(axis)
        return (
            <div key={axis.id} className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </span>
              {(widget === "chips" || widget === "radio" || axis.kind === "custom") && (
                <div className="flex flex-wrap gap-1.5">
                  {axis.values.map((v) => {
                    const selected = selectedOptions[axis.id] === v.id
                    const available = isValueAvailable(axis.id, v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => onOptionSelect(axis.id, v.id)}
                        disabled={!available}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                          selected
                            ? "bg-foreground text-background"
                            : "bg-muted text-foreground hover:bg-muted/80"
                        } ${!available ? "opacity-40 line-through" : ""}`}
                      >
                        {getDisplayLabel(axis.id, v)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="mb-8 space-y-8">
      {axes.map((axis, axisIndex) => {
        const widget = getVariantWidgetForKind(axis.kind)
        const label = resolveAxisLabel(axis)
        const selectedValue = axis.values.find((v) => v.id === selectedOptions[axis.id])
        const selectedLabel = selectedValue ? getDisplayLabel(axis.id, selectedValue) : undefined
        const chooseLabel = t("pdp.chooseOption", { option: label })

        return (
          <section
            key={axis.id}
            className="rounded-3xl border border-border/60 bg-gradient-to-b from-muted/40 to-transparent p-5 sm:p-6"
          >
            <div className="mb-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {axes.length > 1
                    ? `${t("pdp.optionStep") || "Option"} ${axisIndex + 1}`
                    : t("pdp.selectVariant") || "Select variant"}
                </p>
                <h3 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">
                  {chooseLabel}
                </h3>
              </div>
              {selectedLabel ? (
                <span className="shrink-0 rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
                  {selectedLabel}
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {t("pdp.required") || "Required"}
                </span>
              )}
            </div>

            {widget === "swatches" && (
              <div className="flex flex-wrap gap-3">
                {axis.values.map((v) => {
                  const selected = selectedOptions[axis.id] === v.id
                  const available = isValueAvailable(axis.id, v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onOptionSelect(axis.id, v.id)}
                      disabled={!available}
                      className={`relative h-12 w-12 rounded-full transition-all ${
                        selected
                          ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105"
                          : "ring-1 ring-border hover:scale-105"
                      } ${!available ? "opacity-30 cursor-not-allowed" : ""}`}
                      style={{ backgroundColor: v.hex || "#ccc" }}
                      title={getDisplayLabel(axis.id, v)}
                      aria-label={getDisplayLabel(axis.id, v)}
                      aria-pressed={selected}
                    >
                      {selected && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {useOptionTiles && axis.id === axes[0].id && (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {axis.values.map((v) => {
                  const selected = selectedOptions[axis.id] === v.id
                  const available = isValueAvailable(axis.id, v.id)
                  const price = priceForValue(axis.id, v.id)
                  const displayLabel = getDisplayLabel(axis.id, v)
                  const imageUrl = imageForValue(axis.id, v.id, displayLabel)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onOptionSelect(axis.id, v.id)}
                      disabled={!available}
                      aria-pressed={selected}
                      className={`group relative flex items-center gap-3 rounded-2xl border p-2.5 pr-3 text-left transition-all ${
                        selected
                          ? "border-neutral-900 bg-neutral-900 shadow-lg shadow-black/10 dark:border-neutral-100 dark:bg-neutral-100"
                          : "border-border/70 bg-background hover:border-foreground/40 hover:bg-muted/40"
                      } ${!available ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <div
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted ${
                          selected ? "ring-1 ring-white/30 dark:ring-black/20" : ""
                        }`}
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-center"
                            onError={(e) => {
                              const parentUrl =
                                typeof fallbackImageUrl === "string" ? fallbackImageUrl.trim() : ""
                              if (parentUrl && e.currentTarget.src !== parentUrl) {
                                e.currentTarget.src = parentUrl
                                return
                              }
                              e.currentTarget.style.opacity = "0"
                            }}
                          />
                        ) : null}
                      </div>
                      <div className={`min-w-0 flex-1 ${!available ? "line-through" : ""}`}>
                        <div
                          className={`truncate text-base font-bold tracking-tight min-h-[1.5rem] ${
                            selected
                              ? "text-white dark:text-neutral-900"
                              : "text-foreground"
                          }`}
                        >
                          {displayLabel}
                        </div>
                        {price != null && (
                          <div
                            className={`mt-0.5 text-sm font-medium ${
                              selected
                                ? "text-white/80 dark:text-neutral-700"
                                : "text-muted-foreground"
                            }`}
                          >
                            {formatPrice(price, currency)}
                          </div>
                        )}
                      </div>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          selected
                            ? "border-white/40 bg-white text-neutral-900 dark:border-neutral-900/30 dark:bg-neutral-900 dark:text-white"
                            : "border-border text-transparent group-hover:border-foreground/30"
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {!useOptionTiles && (widget === "chips" || widget === "radio") && (
              <div className="flex flex-wrap gap-2.5">
                {axis.values.map((v) => {
                  const selected = selectedOptions[axis.id] === v.id
                  const available = isValueAvailable(axis.id, v.id)
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onOptionSelect(axis.id, v.id)}
                      disabled={!available}
                      aria-pressed={selected}
                      className={`min-w-[3.5rem] rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                        selected
                          ? "bg-foreground text-background shadow-md"
                          : "bg-background border border-border hover:border-foreground/40"
                      } ${!available ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                    >
                      {getDisplayLabel(axis.id, v)}
                    </button>
                  )
                })}
              </div>
            )}

            {widget === "select" && (
              <Select
                value={selectedOptions[axis.id] || ""}
                onValueChange={(val) => onOptionSelect(axis.id, val)}
              >
                <SelectTrigger className="h-12 w-full rounded-2xl text-base font-semibold">
                  <SelectValue
                    placeholder={t("pdp.selectOptionPlaceholder", { option: label })}
                  />
                </SelectTrigger>
                <SelectContent>
                  {axis.values.map((v) => (
                    <SelectItem
                      key={v.id}
                      value={v.id}
                      disabled={!isValueAvailable(axis.id, v.id)}
                    >
                      {getDisplayLabel(axis.id, v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>
        )
      })}
    </div>
  )
}
