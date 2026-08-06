"use client"

import type { ReactNode } from "react"
import { DynamicPricingConfig, DynamicQuoteField, DynamicQuoteFieldType } from "@/app/types"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Minus, Plus } from "@/app/components/ui/icons"
import { formatQuoteExpirationLabel } from "@/app/catalog/dynamic-pricing"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import {
  DynamicQuoteFieldInput,
  passwordManagerIgnoreProps,
} from "./dynamic-quote-field-input"

export { validateDynamicQuoteFields } from "./dynamic-quote-field-input"

export interface DynamicQuoteFieldsFormProps {
  config: DynamicPricingConfig
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  quantity?: number
  onQuantityChange?: (qty: number) => void
  showQuantity?: boolean
  showExpirationHint?: boolean
  disabled?: boolean
  /** stack = single column; grid = multi-column; composer = route/when/details groups */
  layout?: "stack" | "grid" | "composer"
  /** Rendered inside the Route group (composer layout only) */
  routePreview?: ReactNode
}

function fieldSpanClass(type: DynamicQuoteFieldType, layout: "stack" | "grid" | "composer"): string {
  if (layout !== "grid") return ""
  if (type === "address" || type === "boolean") return "sm:col-span-2 lg:col-span-3"
  return ""
}

function isRouteField(type: DynamicQuoteFieldType) {
  return type === "location" || type === "address" || type === "distance"
}

function isWhenField(type: DynamicQuoteFieldType) {
  return type === "date"
}

function groupComposerFields(fields: DynamicQuoteField[]) {
  const route: DynamicQuoteField[] = []
  const when: DynamicQuoteField[] = []
  const details: DynamicQuoteField[] = []
  for (const field of fields) {
    if (isRouteField(field.type)) route.push(field)
    else if (isWhenField(field.type)) when.push(field)
    else details.push(field)
  }
  return { route, when, details }
}

function QuantityStepper({
  quantity,
  onChange,
  disabled,
  label,
}: {
  quantity: number
  onChange: (qty: number) => void
  disabled?: boolean
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background px-4 py-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl"
          disabled={disabled || quantity <= 1}
          onClick={() => onChange(Math.max(1, quantity - 1))}
          aria-label="Decrease quantity"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-10 text-center text-base font-semibold tabular-nums">{quantity}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-xl"
          disabled={disabled}
          onClick={() => onChange(quantity + 1)}
          aria-label="Increase quantity"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FieldBlock({
  field,
  value,
  onChange,
  disabled,
  t,
  large,
}: {
  field: DynamicQuoteField
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  t: (key: string) => string
  large?: boolean
}) {
  return (
    <div className="space-y-2">
      {field.type !== "boolean" && (
        <Label className={cn(large && "text-xs uppercase tracking-wider text-muted-foreground")}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
      )}
      <DynamicQuoteFieldInput
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        t={t}
        large={large}
      />
    </div>
  )
}

function RouteStack({
  fields,
  values,
  setField,
  disabled,
  t,
  mapPreview,
}: {
  fields: DynamicQuoteField[]
  values: Record<string, unknown>
  setField: (key: string, value: unknown) => void
  disabled?: boolean
  t: (key: string) => string
  mapPreview?: ReactNode
}) {
  const placeFields = fields.filter((f) => f.type === "location" || f.type === "address")
  const distanceFields = fields.filter((f) => f.type === "distance")
  const stacked = placeFields.slice(0, 2)
  const restPlaces = placeFields.slice(2)

  return (
    <div className="space-y-4">
      {stacked.length >= 2 ? (
        <div className="rounded-3xl border border-border/60 bg-background overflow-hidden">
          <div className="relative">
            <div className="absolute left-6 top-10 bottom-10 w-px bg-border" aria-hidden />
            <div
              className="absolute left-[1.35rem] top-10 h-2.5 w-2.5 rounded-full bg-foreground"
              aria-hidden
            />
            <div
              className="absolute left-[1.35rem] bottom-10 h-2.5 w-2.5 rounded-full border-2 border-foreground bg-background"
              aria-hidden
            />
            <div className="pl-12 pr-4 pt-4 pb-2">
              <FieldBlock
                field={stacked[0]}
                value={values[stacked[0].key]}
                onChange={(v) => setField(stacked[0].key, v)}
                disabled={disabled}
                t={t}
                large
              />
            </div>
            <div className="border-t border-border/50" />
            <div className="pl-12 pr-4 pt-2 pb-4">
              <FieldBlock
                field={stacked[1]}
                value={values[stacked[1].key]}
                onChange={(v) => setField(stacked[1].key, v)}
                disabled={disabled}
                t={t}
                large
              />
            </div>
          </div>
          {mapPreview && (
            <div className="border-t border-border/50">{mapPreview}</div>
          )}
        </div>
      ) : (
        <>
          {placeFields.map((field) => (
            <FieldBlock
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => setField(field.key, v)}
              disabled={disabled}
              t={t}
              large
            />
          ))}
          {mapPreview}
        </>
      )}

      {(restPlaces.length > 0 || distanceFields.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...restPlaces, ...distanceFields].map((field) => (
            <FieldBlock
              key={field.key}
              field={field}
              value={values[field.key]}
              onChange={(v) => setField(field.key, v)}
              disabled={disabled}
              t={t}
              large
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DynamicQuoteFieldsForm({
  config,
  values,
  onChange,
  quantity = 1,
  onQuantityChange,
  showQuantity = true,
  showExpirationHint = true,
  disabled,
  layout = "stack",
  routePreview,
}: DynamicQuoteFieldsFormProps) {
  const { t } = useLocalization()
  const setField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value })
  }
  const fields = config.fields || []

  if (layout === "composer") {
    const { route, when, details } = groupComposerFields(fields)
    return (
      <div className="space-y-5" data-lpignore="true" data-1p-ignore="true">
        {showExpirationHint && (
          <p className="text-xs text-muted-foreground">
            {(t("pdp.dynamicQuote.validFor") || "Quote valid for {duration}.").replace(
              "{duration}",
              formatQuoteExpirationLabel(config.quote_expiration, t)
            )}
          </p>
        )}

        {showQuantity && onQuantityChange && (
          <QuantityStepper
            quantity={quantity}
            onChange={onQuantityChange}
            disabled={disabled}
            label={t("common.quantity") || "Quantity"}
          />
        )}

        {route.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("pdp.dynamicQuote.groups.route") || "Route"}
            </h4>
            <RouteStack
              fields={route}
              values={values}
              setField={setField}
              disabled={disabled}
              t={t}
              mapPreview={routePreview}
            />
          </section>
        )}

        {when.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("pdp.dynamicQuote.groups.when") || "When"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {when.map((field) => (
                <FieldBlock
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setField(field.key, v)}
                  disabled={disabled}
                  t={t}
                  large
                />
              ))}
            </div>
          </section>
        )}

        {details.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("pdp.dynamicQuote.groups.details") || "Details"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {details.map((field) => (
                <FieldBlock
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  onChange={(v) => setField(field.key, v)}
                  disabled={disabled}
                  t={t}
                  large
                />
              ))}
            </div>
          </section>
        )}

        {fields.length === 0 && !showQuantity && (
          <p className="text-sm text-muted-foreground">
            {t("pdp.dynamicQuote.noFieldsRequired") || "No additional fields required."}
          </p>
        )}
      </div>
    )
  }

  const fieldsGrid =
    layout === "grid"
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5"
      : "space-y-4"

  return (
    <div className="space-y-4" data-lpignore="true" data-1p-ignore="true">
      {showExpirationHint && (
        <p className="text-sm text-muted-foreground">
          {(t("pdp.dynamicQuote.validFor") || "Quote valid for {duration}.").replace(
            "{duration}",
            formatQuoteExpirationLabel(config.quote_expiration, t)
          )}
        </p>
      )}

      <div className={fieldsGrid}>
        {showQuantity && onQuantityChange && (
          <div className="space-y-2">
            <Label>{t("common.quantity") || "Quantity"}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={quantity}
              onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
              disabled={disabled}
              className="h-12 rounded-xl"
              autoComplete="off"
              {...passwordManagerIgnoreProps}
            />
          </div>
        )}

        {fields.map((field) => (
          <div key={field.key} className={cn("space-y-2", fieldSpanClass(field.type, layout))}>
            {field.type !== "boolean" && (
              <Label>
                {field.label}
                {field.required ? " *" : ""}
              </Label>
            )}
            <DynamicQuoteFieldInput
              field={field}
              value={values[field.key]}
              onChange={(v) => setField(field.key, v)}
              disabled={disabled}
              t={t}
            />
          </div>
        ))}
      </div>

      {fields.length === 0 && !showQuantity && (
        <p className="text-sm text-muted-foreground">
          {t("pdp.dynamicQuote.noFieldsRequired") || "No additional fields required."}
        </p>
      )}
    </div>
  )
}
