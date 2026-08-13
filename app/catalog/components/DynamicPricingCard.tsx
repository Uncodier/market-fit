"use client"

import { useMemo } from "react"
import { CatalogItem, DynamicPricingConfig, DynamicQuoteField, DynamicQuoteFieldType } from "@/app/types"
import {
  DEFAULT_DYNAMIC_PRICING,
  DEFAULT_QUOTE_EXPIRATION,
  DYNAMIC_QUOTE_FIELD_TYPES,
  getDynamicPricingConfig,
  slugifyFieldKey,
} from "@/app/catalog/dynamic-pricing"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Switch } from "@/app/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useLocalization } from "@/app/context/LocalizationContext"
import { GripHorizontal, Plus, Trash2 } from "@/app/components/ui/icons"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"

interface DynamicPricingCardProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  onChange: (next: Partial<CatalogItem>) => void
  onSave: () => void
  saving?: boolean
}

export function DynamicPricingCard({
  item,
  formData,
  onChange,
  onSave,
  saving,
}: DynamicPricingCardProps) {
  const { t } = useLocalization()
  const enabled = Boolean(formData.is_dynamic_price)
  const config = useMemo(() => {
    const fromForm = formData.metadata?.dynamic_pricing
    if (fromForm) {
      return {
        ...DEFAULT_DYNAMIC_PRICING,
        ...fromForm,
        quote_expiration: fromForm.quote_expiration || DEFAULT_QUOTE_EXPIRATION,
        fields: Array.isArray(fromForm.fields) ? fromForm.fields : [],
      }
    }
    return getDynamicPricingConfig({
      ...(item || {}),
      ...formData,
      is_dynamic_price: true,
    } as CatalogItem) || DEFAULT_DYNAMIC_PRICING
  }, [formData, item])

  const patchConfig = (patch: Partial<DynamicPricingConfig>) => {
    const nextConfig: DynamicPricingConfig = {
      ...config,
      ...patch,
    }
    const minPrice = nextConfig.min_price
    onChange({
      ...formData,
      lowest_sale_price:
        minPrice !== undefined && minPrice !== null
          ? minPrice
          : formData.lowest_sale_price,
      metadata: {
        ...(formData.metadata || {}),
        dynamic_pricing: nextConfig,
      },
    })
  }

  const addField = () => {
    const index = config.fields.length + 1
    let label = `${t("catalog.dynamicPricing.fieldLabelPrefix") || "Field"} ${index}`
    let key = slugifyFieldKey(label)
    let n = index
    while (config.fields.some((f) => f.key === key)) {
      n += 1
      label = `Field ${n}`
      key = slugifyFieldKey(label)
    }
    const field: DynamicQuoteField = {
      key,
      label,
      type: "text",
      required: false,
    }
    patchConfig({ fields: [...config.fields, field] })
  }

  const updateField = (index: number, patch: Partial<DynamicQuoteField>) => {
    const fields = config.fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    patchConfig({ fields })
  }

  const syncFieldKeyFromLabel = (index: number, label: string) => {
    const base = slugifyFieldKey(label)
    const others = config.fields.filter((_, i) => i !== index)
    let nextKey = base
    let n = 2
    while (others.some((f) => f.key === nextKey)) {
      nextKey = `${base}_${n}`
      n += 1
    }
    if (nextKey !== config.fields[index]?.key) {
      updateField(index, { key: nextKey })
    }
  }

  const removeField = (index: number) => {
    patchConfig({ fields: config.fields.filter((_, i) => i !== index) })
  }

  const reorderFields = (from: number, to: number) => {
    if (to < 0 || to >= config.fields.length || from === to) return
    const fields = [...config.fields]
    const [moved] = fields.splice(from, 1)
    fields.splice(to, 0, moved)
    patchConfig({ fields })
  }

  const onFieldDragEnd = (result: DropResult) => {
    if (!result.destination) return
    reorderFields(result.source.index, result.destination.index)
  }

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>
          {t("catalog.dynamicPricing.title") || "Dynamic pricing"}
        </SectionCardTitle>
        <SectionCardDescription>
          {t("catalog.dynamicPricing.description") ||
            "Configure AI-assisted quotations with custom fields and pricing rules."}
        </SectionCardDescription>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="is_dynamic_price" className="text-base cursor-pointer">
              {t("catalog.dynamicPricing.enabled") || "Enable dynamic pricing"}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t("catalog.dynamicPricing.enabledHelp") ||
                "Buyers request a quote instead of paying a fixed price."}
            </p>
          </div>
          <Switch
            id="is_dynamic_price"
            checked={enabled}
            onCheckedChange={(checked) =>
              onChange({
                ...formData,
                is_dynamic_price: checked,
                metadata: {
                  ...(formData.metadata || {}),
                  dynamic_pricing: checked
                    ? formData.metadata?.dynamic_pricing || {
                        ...DEFAULT_DYNAMIC_PRICING,
                        min_price: formData.lowest_sale_price ?? undefined,
                      }
                    : formData.metadata?.dynamic_pricing,
                },
              })
            }
          />
        </div>

        {enabled && (
          <div className="space-y-6 pt-2 border-t">
            <div className="space-y-2">
              <Label>{t("catalog.dynamicPricing.agentPrompt") || "Agent prompt"}</Label>
              <Textarea
                value={config.agent_prompt || ""}
                onChange={(e) => patchConfig({ agent_prompt: e.target.value })}
                placeholder={
                  t("catalog.dynamicPricing.agentPromptPlaceholder") ||
                  "Instructions for the quoting agent..."
                }
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("catalog.dynamicPricing.minPrice") || "Minimum price"}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={config.min_price ?? ""}
                  onChange={(e) =>
                    patchConfig({
                      min_price: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("catalog.dynamicPricing.revisionCount") || "Revision count"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={config.revision_count ?? 1}
                  onChange={(e) =>
                    patchConfig({ revision_count: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                {t("catalog.dynamicPricing.quoteExpiration") || "Quote expiration"}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-28"
                  value={config.quote_expiration?.value ?? DEFAULT_QUOTE_EXPIRATION.value}
                  onChange={(e) =>
                    patchConfig({
                      quote_expiration: {
                        value: Math.max(1, Number(e.target.value) || 1),
                        unit: config.quote_expiration?.unit || "days",
                      },
                    })
                  }
                />
                <Select
                  value={config.quote_expiration?.unit || "days"}
                  onValueChange={(unit: "minutes" | "hours" | "days") =>
                    patchConfig({
                      quote_expiration: {
                        value: config.quote_expiration?.value || 30,
                        unit,
                      },
                    })
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">{t("common.time.minutes") || "Minutes"}</SelectItem>
                    <SelectItem value="hours">{t("common.time.hours") || "Hours"}</SelectItem>
                    <SelectItem value="days">{t("common.time.days") || "Days"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("catalog.dynamicPricing.quoteExpirationHelp") ||
                  "Shown in shop and marketplace as how long the calculated price remains valid."}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="text-base">
                  {t("catalog.dynamicPricing.advancedCompute") || "Advanced compute"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("catalog.dynamicPricing.advancedComputeHelp") ||
                    "Uses one dedicated requirement and robot instance per product."}
                </p>
              </div>
              <Switch
                checked={Boolean(config.requires_advanced_compute)}
                onCheckedChange={(checked) =>
                  patchConfig({ requires_advanced_compute: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label className="text-base">
                  {t("catalog.dynamicPricing.requiresAuthorization") ||
                    "Requires authorization"}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("catalog.dynamicPricing.requiresAuthorizationHelp") ||
                    "Quote stays pending in the dashboard until a seller sends it."}
                </p>
              </div>
              <Switch
                checked={Boolean(config.requires_authorization)}
                onCheckedChange={(checked) =>
                  patchConfig({ requires_authorization: checked })
                }
              />
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-base">
                    {t("catalog.dynamicPricing.fields") || "Quote fields"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("catalog.dynamicPricing.fieldsHelp") ||
                      "Extra inputs collected before calculating the quote."}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addField}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("catalog.dynamicPricing.addField") || "Add field"}
                </Button>
              </div>

              {config.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("catalog.dynamicPricing.noFields") ||
                    "No quote fields yet. Click Add field to create one."}
                </p>
              )}

              <DragDropContext onDragEnd={onFieldDragEnd}>
                <Droppable droppableId="quote-fields">
                  {(dropProvided) => (
                    <div
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="space-y-3"
                    >
                      {config.fields.map((field, index) => (
                        <Draggable
                          key={field.key}
                          draggableId={field.key}
                          index={index}
                        >
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`space-y-2 p-3 rounded-lg border bg-muted/20 ${
                                snapshot.isDragging ? "shadow-md ring-1 ring-primary/30" : ""
                              }`}
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_160px_auto] gap-3 items-end">
                                <button
                                  type="button"
                                  className="mb-1 inline-flex h-10 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing"
                                  aria-label={
                                    t("catalog.dynamicPricing.reorderField") ||
                                    "Reorder field"
                                  }
                                  {...dragProvided.dragHandleProps}
                                >
                                  <GripHorizontal className="h-4 w-4" />
                                </button>
                                <div className="space-y-1 min-w-0">
                                  <Label className="text-xs">{t("catalog.dynamicPricing.fieldLabel") || "Label"}</Label>
                                  <Input
                                    value={field.label}
                                    onChange={(e) =>
                                      updateField(index, { label: e.target.value })
                                    }
                                    onBlur={(e) =>
                                      syncFieldKeyFromLabel(index, e.target.value)
                                    }
                                    placeholder={t("catalog.dynamicPricing.fieldLabelPlaceholder") || "Field label"}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("catalog.dynamicPricing.fieldType") || "Type"}</Label>
                                  <Select
                                    value={field.type}
                                    onValueChange={(type: DynamicQuoteFieldType) =>
                                      updateField(index, {
                                        type,
                                        options:
                                          type === "select"
                                            ? field.options || []
                                            : undefined,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DYNAMIC_QUOTE_FIELD_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                          {t(`catalog.dynamicPricing.fieldTypes.${type.value}`) || type.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex items-center gap-3 pb-0.5">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={Boolean(field.required)}
                                      onCheckedChange={(checked) =>
                                        updateField(index, { required: checked })
                                      }
                                    />
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {t("catalog.dynamicPricing.fieldRequired") || "Required"}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeField(index)}
                                    aria-label={t("catalog.dynamicPricing.removeField") || "Remove field"}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {field.type === "select" && (
                                <div className="space-y-1 sm:pl-11">
                                  <Label className="text-xs">
                                    {t("catalog.dynamicPricing.optionsLabel") || "Options (comma-separated)"}
                                  </Label>
                                  <Input
                                    value={(field.options || []).join(", ")}
                                    onChange={(e) =>
                                      updateField(index, {
                                        options: e.target.value
                                          .split(",")
                                          .map((o) => o.trim())
                                          .filter(Boolean),
                                      })
                                    }
                                    placeholder={t("catalog.dynamicPricing.optionsPlaceholder") || "Option A, Option B"}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </div>
        )}
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" onClick={onSave} disabled={saving} size="sm">
          {t("catalog.dynamicPricing.save") || "Save dynamic pricing"}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}
