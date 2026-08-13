"use client"

import { useEffect, useState } from "react"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { DatePicker } from "@/app/components/ui/date-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listCatalogCategories, listCatalogItems } from "@/app/catalog/actions"
import { PromotionTargetPicker } from "./PromotionTargetPicker"

const WEEKDAYS = [
  { value: 0, labelKey: "settings.company.days.sunday", fallback: "Sunday" },
  { value: 1, labelKey: "settings.company.days.monday", fallback: "Monday" },
  { value: 2, labelKey: "settings.company.days.tuesday", fallback: "Tuesday" },
  { value: 3, labelKey: "settings.company.days.wednesday", fallback: "Wednesday" },
  { value: 4, labelKey: "settings.company.days.thursday", fallback: "Thursday" },
  { value: 5, labelKey: "settings.company.days.friday", fallback: "Friday" },
  { value: 6, labelKey: "settings.company.days.saturday", fallback: "Saturday" },
]

export type RequiredPromoItemDraft = {
  catalog_item_id: string
  min_quantity: number
  name?: string
}

export type RequiredPromoCategoryDraft = {
  catalog_category_id: string
  min_quantity: number
  name?: string
}

export type PromotionRestrictionsValue = {
  starts_at?: string | null
  ends_at?: string | null
  active_weekdays?: number[]
  min_order_amount?: number | null
  required_items_mode?: "all" | "any"
}

interface RestrictionToggleProps {
  id: string
  title: string
  description: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  children?: React.ReactNode
}

function RestrictionToggle({
  id,
  title,
  description,
  enabled,
  onEnabledChange,
  children,
}: RestrictionToggleProps) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-row items-center justify-between p-3">
        <div className="space-y-0.5 pr-4">
          <Label htmlFor={id} className="text-sm cursor-pointer">
            {title}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Switch
          id={id}
          checked={enabled}
          onCheckedChange={(v) => onEnabledChange(!!v)}
        />
      </div>
      {enabled && children && (
        <div className="border-t p-3 bg-muted/20 space-y-3">{children}</div>
      )}
    </div>
  )
}

interface PromotionRestrictionsFieldsProps {
  siteId?: string | null
  siteTimezone?: string | null
  idPrefix?: string
  value: PromotionRestrictionsValue
  onChange: (patch: Partial<PromotionRestrictionsValue>) => void
  requiredItems: RequiredPromoItemDraft[]
  onRequiredItemsChange: (items: RequiredPromoItemDraft[]) => void
  requiredCategories: RequiredPromoCategoryDraft[]
  onRequiredCategoriesChange: (categories: RequiredPromoCategoryDraft[]) => void
}

export function PromotionRestrictionsFields({
  siteId,
  siteTimezone,
  idPrefix = "promo-restriction",
  value,
  onChange,
  requiredItems,
  onRequiredItemsChange,
  requiredCategories,
  onRequiredCategoriesChange,
}: PromotionRestrictionsFieldsProps) {
  const { t } = useLocalization()
  const [itemNameById, setItemNameById] = useState<Record<string, string>>({})
  const [categoryNameById, setCategoryNameById] = useState<Record<string, string>>({})
  const [scheduleOn, setScheduleOn] = useState(Boolean(value.starts_at || value.ends_at))
  const [availabilityOn, setAvailabilityOn] = useState(
    (value.active_weekdays?.length || 0) > 0
  )
  const [minSpendOn, setMinSpendOn] = useState(
    value.min_order_amount != null && Number(value.min_order_amount) > 0
  )
  const [requiredOn, setRequiredOn] = useState(
    requiredItems.length > 0 || requiredCategories.length > 0
  )

  // Sync toggles when loaded data arrives
  useEffect(() => {
    setScheduleOn(Boolean(value.starts_at || value.ends_at))
  }, [value.starts_at, value.ends_at])

  useEffect(() => {
    setAvailabilityOn((value.active_weekdays?.length || 0) > 0)
  }, [value.active_weekdays])

  useEffect(() => {
    setMinSpendOn(
      value.min_order_amount != null && Number(value.min_order_amount) > 0
    )
  }, [value.min_order_amount])

  useEffect(() => {
    if (requiredItems.length > 0 || requiredCategories.length > 0) {
      setRequiredOn(true)
    }
  }, [requiredItems.length, requiredCategories.length])

  const activeWeekdays = value.active_weekdays || []
  const startsAt = value.starts_at ? new Date(value.starts_at) : undefined
  const endsAt = value.ends_at ? new Date(value.ends_at) : undefined

  useEffect(() => {
    let cancelled = false
    async function loadNames() {
      if (!siteId) return
      const [itemsRes, catsRes] = await Promise.all([
        listCatalogItems({ siteId, pageSize: 1000 }),
        listCatalogCategories(siteId),
      ])
      if (cancelled) return
      if (itemsRes.data) {
        const map: Record<string, string> = {}
        for (const item of itemsRes.data) {
          map[item.id] = item.sku ? `${item.name} (${item.sku})` : item.name
        }
        setItemNameById(map)
      }
      if (catsRes.data) {
        const map: Record<string, string> = {}
        for (const cat of catsRes.data) {
          map[cat.id] = cat.name
        }
        setCategoryNameById(map)
      }
    }
    void loadNames()
    return () => {
      cancelled = true
    }
  }, [siteId])

  const toggleWeekday = (day: number) => {
    if (activeWeekdays.includes(day)) {
      onChange({ active_weekdays: activeWeekdays.filter((d) => d !== day) })
    } else {
      onChange({
        active_weekdays: [...activeWeekdays, day].sort((a, b) => a - b),
      })
    }
  }

  return (
    <div className="space-y-3">
      <RestrictionToggle
        id={`${idPrefix}-schedule`}
        title={t("promotions.detail.restrictions.schedule") || "Schedule"}
        description={
          t("promotions.detail.restrictions.scheduleDesc") ||
          "Limit the promotion to a start and end date"
        }
        enabled={scheduleOn}
        onEnabledChange={(enabled) => {
          setScheduleOn(enabled)
          if (!enabled) {
            onChange({ starts_at: null, ends_at: null })
            return
          }
          const now = new Date()
          const end = new Date(now)
          end.setDate(end.getDate() + 30)
          onChange({
            starts_at: value.starts_at || now.toISOString(),
            ends_at: value.ends_at || end.toISOString(),
          })
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>
              {t("promotions.detail.restrictions.startsAt") || "Starts At"}
            </Label>
            <DatePicker
              date={startsAt}
              setDate={(d) => onChange({ starts_at: d.toISOString() })}
              placeholder={
                t("promotions.detail.restrictions.selectStart") ||
                "Select start date"
              }
              mode="calendar"
              showTimePicker
              timeFormat="24h"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t("promotions.detail.restrictions.endsAt") || "Ends At"}
            </Label>
            <DatePicker
              date={endsAt}
              setDate={(d) => onChange({ ends_at: d.toISOString() })}
              placeholder={
                t("promotions.detail.restrictions.selectEnd") ||
                "Select end date"
              }
              mode="calendar"
              showTimePicker
              timeFormat="24h"
              className="w-full"
            />
          </div>
        </div>
        {siteTimezone && (
          <p className="text-xs text-muted-foreground">
            {t("promotions.detail.restrictions.weekdayTimezone", {
              timezone: siteTimezone,
            }) || `Weekday checks use ${siteTimezone}`}
          </p>
        )}
      </RestrictionToggle>

      <RestrictionToggle
        id={`${idPrefix}-availability`}
        title={
          t("promotions.detail.restrictions.availability") || "Availability"
        }
        description={
          t("promotions.detail.restrictions.availabilityDesc") ||
          "Limit the promotion to specific days of the week"
        }
        enabled={availabilityOn}
        onEnabledChange={(enabled) => {
          setAvailabilityOn(enabled)
          if (!enabled) {
            onChange({ active_weekdays: [] })
            return
          }
          onChange({
            active_weekdays:
              activeWeekdays.length > 0 ? activeWeekdays : [1, 2, 3, 4, 5],
          })
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WEEKDAYS.map((day) => {
            const dayId = `${idPrefix}-day-${day.value}`
            const isActive = activeWeekdays.includes(day.value)
            return (
              <div key={day.value} className="flex items-center space-x-2 overflow-visible py-1.5">
                <Checkbox
                  id={dayId}
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      if (!isActive) toggleWeekday(day.value)
                    } else if (isActive) {
                      toggleWeekday(day.value)
                    }
                  }}
                />
                <label htmlFor={dayId} className="text-sm cursor-pointer">
                  {t(day.labelKey) || day.fallback}
                </label>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("promotions.detail.restrictions.onlySelectedDays") ||
            "Only applies on selected days"}
        </p>
      </RestrictionToggle>

      <RestrictionToggle
        id={`${idPrefix}-min-spend`}
        title={t("promotions.detail.restrictions.minSpend") || "Minimum spend"}
        description={
          t("promotions.detail.restrictions.minSpendDesc") ||
          "Valid if cart subtotal is greater than or equal to an amount"
        }
        enabled={minSpendOn}
        onEnabledChange={(enabled) => {
          setMinSpendOn(enabled)
          onChange({
            min_order_amount: enabled
              ? value.min_order_amount && value.min_order_amount > 0
                ? value.min_order_amount
                : 100
              : null,
          })
        }}
      >
        <div className="space-y-2 max-w-xs">
          <Label>
            {t("promotions.detail.restrictions.minOrderAmount") ||
              "Minimum Order Amount"}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value.min_order_amount ?? ""}
            onChange={(e) =>
              onChange({
                min_order_amount: e.target.value
                  ? parseFloat(e.target.value)
                  : null,
              })
            }
          />
        </div>
      </RestrictionToggle>

      <RestrictionToggle
        id={`${idPrefix}-required-products`}
        title={
          t("promotions.detail.restrictions.required") ||
          "Required products or categories"
        }
        description={
          t("promotions.detail.restrictions.requiredDesc") ||
          "Valid if the cart includes specific products and/or categories"
        }
        enabled={requiredOn}
        onEnabledChange={(enabled) => {
          setRequiredOn(enabled)
          if (!enabled) {
            onRequiredItemsChange([])
            onRequiredCategoriesChange([])
          }
        }}
      >
        <div className="space-y-2">
          <Label>
            {t("promotions.detail.restrictions.matchMode") || "Match mode"}
          </Label>
          <Tabs
            value={value.required_items_mode || "all"}
            onValueChange={(v) =>
              onChange({ required_items_mode: v as "all" | "any" })
            }
          >
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                {t("promotions.detail.restrictions.mustAll") ||
                  "Must include ALL"}
              </TabsTrigger>
              <TabsTrigger value="any" className="text-xs sm:text-sm">
                {t("promotions.detail.restrictions.mustAny") ||
                  "Must include ANY"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <PromotionTargetPicker
          siteId={siteId}
          selectedItemIds={requiredItems.map((i) => i.catalog_item_id)}
          selectedCategoryIds={requiredCategories.map(
            (c) => c.catalog_category_id
          )}
          itemQuantities={Object.fromEntries(
            requiredItems.map((i) => [i.catalog_item_id, i.min_quantity])
          )}
          categoryQuantities={Object.fromEntries(
            requiredCategories.map((c) => [
              c.catalog_category_id,
              c.min_quantity,
            ])
          )}
          onItemQuantityChange={(id, quantity) => {
            onRequiredItemsChange(
              requiredItems.map((i) =>
                i.catalog_item_id === id
                  ? { ...i, min_quantity: quantity }
                  : i
              )
            )
          }}
          onCategoryQuantityChange={(id, quantity) => {
            onRequiredCategoriesChange(
              requiredCategories.map((c) =>
                c.catalog_category_id === id
                  ? { ...c, min_quantity: quantity }
                  : c
              )
            )
          }}
          onItemsChange={(newIds) => {
            onRequiredItemsChange(
              newIds.map((id) => {
                const existing = requiredItems.find(
                  (i) => i.catalog_item_id === id
                )
                return (
                  existing || {
                    catalog_item_id: id,
                    min_quantity: 1,
                    name: itemNameById[id],
                  }
                )
              })
            )
          }}
          onCategoriesChange={(newIds) => {
            onRequiredCategoriesChange(
              newIds.map((id) => {
                const existing = requiredCategories.find(
                  (c) => c.catalog_category_id === id
                )
                return (
                  existing || {
                    catalog_category_id: id,
                    min_quantity: 1,
                    name: categoryNameById[id],
                  }
                )
              })
            )
          }}
        />
      </RestrictionToggle>
    </div>
  )
}
