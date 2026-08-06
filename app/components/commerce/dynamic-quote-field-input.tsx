"use client"

import { format } from "date-fns"
import { DynamicQuoteField, DynamicQuoteFieldType } from "@/app/types"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Switch } from "@/app/components/ui/switch"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Minus, Plus } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export const passwordManagerIgnoreProps = {
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const

export function defaultPlaceholder(
  field: DynamicQuoteField,
  t?: (key: string) => string
): string {
  const tFunc = typeof t === "function" ? t : (k: string) => ""
  if (field.placeholder) return field.placeholder
  switch (field.type) {
    case "phone":
      return "+1 555 000 0000"
    case "address":
      return tFunc("pdp.dynamicQuote.placeholders.address") || "Street, city, postal code"
    case "email":
      return "name@example.com"
    case "number":
    case "distance":
      return "0"
    case "location":
      return tFunc("pdp.dynamicQuote.placeholders.location") || "City or place"
    case "date":
      return "YYYY-MM-DD"
    default:
      return field.label
  }
}

export function DynamicQuoteFieldInput({
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
  t?: (key: string) => string
  large?: boolean
}) {
  const tFunc = typeof t === "function" ? t : (k: string) => ""
  const controlClass = large ? "h-14 rounded-2xl text-base" : "h-12 rounded-xl"

  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          disabled={disabled}
        />
        <span className="text-sm text-muted-foreground">{field.label}</span>
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <Select
        value={value != null ? String(value) : undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className={controlClass}>
          <SelectValue
            placeholder={
              field.placeholder ||
              (tFunc("pdp.dynamicQuote.placeholders.select") || `Select {label}`).replace(
                "{label}",
                field.label
              )
            }
          />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === "address") {
    return (
      <Textarea
        value={value != null ? String(value) : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={defaultPlaceholder(field, tFunc)}
        disabled={disabled}
        rows={large ? 2 : 3}
        autoComplete="off"
        className={cn("rounded-xl", large && "rounded-2xl text-base min-h-[3.5rem]")}
        {...passwordManagerIgnoreProps}
      />
    )
  }

  if (field.type === "date") {
    const asString = value != null ? String(value) : ""
    const selected =
      asString && /^\d{4}-\d{2}-\d{2}$/.test(asString)
        ? new Date(`${asString}T12:00:00`)
        : undefined
    return (
      <DatePicker
        date={selected}
        setDate={(next) => onChange(format(next, "yyyy-MM-dd"))}
        placeholder={
          field.placeholder || tFunc("pdp.dynamicQuote.placeholders.date") || "Select date"
        }
        disabled={disabled}
        mode="task"
        showEvents
        className={cn("w-full", controlClass)}
      />
    )
  }

  const inputPropsByType: Partial<
    Record<
      DynamicQuoteFieldType,
      {
        type: string
        inputMode?: "text" | "tel" | "email" | "decimal" | "numeric"
        min?: number
        step?: string
      }
    >
  > = {
    text: { type: "text" },
    number: { type: "number", inputMode: "decimal", min: 0, step: "any" },
    phone: { type: "tel", inputMode: "tel" },
    email: { type: "email", inputMode: "email" },
    distance: { type: "number", inputMode: "decimal", min: 0, step: "0.01" },
    location: { type: "text" },
  }

  const props = inputPropsByType[field.type] || { type: "text" }
  const isNumeric = field.type === "number" || field.type === "distance"

  if (isNumeric) {
    const num =
      value === "" || value === undefined || value === null
        ? 0
        : typeof value === "number"
          ? value
          : Number(value) || 0
    const step = field.type === "distance" ? 0.01 : 1
    const bump = (delta: number) => {
      const next = Math.max(0, Math.round((num + delta) * 1000) / 1000)
      onChange(next)
    }
    return (
      <div
        className={cn(
          "flex items-stretch border border-input bg-background overflow-hidden box-border",
          large ? "h-14 rounded-2xl" : "h-12 rounded-xl"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-none h-full",
            large ? "w-14" : "w-12"
          )}
          disabled={disabled || num <= 0}
          onClick={() => bump(-step)}
          aria-label="Decrease"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="number"
          inputMode={props.inputMode}
          autoComplete="off"
          value={value != null ? String(value) : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          placeholder={defaultPlaceholder(field, tFunc)}
          disabled={disabled}
          min={props.min}
          step={props.step}
          className={cn(
            "border-0 shadow-none focus-visible:ring-0 text-center bg-transparent rounded-none h-full flex-1",
            large && "text-base"
          )}
          {...passwordManagerIgnoreProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-none h-full",
            large ? "w-14" : "w-12"
          )}
          disabled={disabled}
          onClick={() => bump(step)}
          aria-label="Increase"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <Input
      type={props.type}
      inputMode={props.inputMode}
      autoComplete="off"
      value={value != null ? String(value) : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={defaultPlaceholder(field, tFunc)}
      disabled={disabled}
      min={props.min}
      step={props.step}
      className={controlClass}
      {...passwordManagerIgnoreProps}
    />
  )
}

export function validateDynamicQuoteFields(
  config: { fields?: DynamicQuoteField[] },
  values: Record<string, unknown>,
  t?: (key: string) => string
): string | null {
  const tFunc = typeof t === "function" ? t : (k: string) => ""
  for (const field of config.fields || []) {
    const v = values[field.key]
    if (field.type === "boolean") continue
    const empty = v === undefined || v === null || v === ""
    if (field.required && empty) {
      return (tFunc("pdp.dynamicQuote.errors.required") || "{label} is required").replace(
        "{label}",
        field.label
      )
    }
    if (empty) continue
    const asString = String(v).trim()
    if (field.type === "phone") {
      const digits = asString.replace(/\D/g, "")
      if (digits.length < 7 || digits.length > 15) {
        return (
          tFunc("pdp.dynamicQuote.errors.phone") || "{label} must be a valid phone number"
        ).replace("{label}", field.label)
      }
    }
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString)) {
      return (tFunc("pdp.dynamicQuote.errors.email") || "{label} must be a valid email").replace(
        "{label}",
        field.label
      )
    }
    if (field.type === "number" || field.type === "distance") {
      const num = typeof v === "number" ? v : Number(asString)
      if (Number.isNaN(num)) {
        return (tFunc("pdp.dynamicQuote.errors.number") || "{label} must be a number").replace(
          "{label}",
          field.label
        )
      }
    }
    if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
        return (tFunc("pdp.dynamicQuote.errors.date") || "{label} must be a valid date").replace(
          "{label}",
          field.label
        )
      }
      const [year, month, day] = asString.split("-").map(Number)
      const parsed = new Date(year, month - 1, day)
      if (
        parsed.getFullYear() !== year ||
        parsed.getMonth() !== month - 1 ||
        parsed.getDate() !== day
      ) {
        return (tFunc("pdp.dynamicQuote.errors.date") || "{label} must be a valid date").replace(
          "{label}",
          field.label
        )
      }
    }
  }
  return null
}
