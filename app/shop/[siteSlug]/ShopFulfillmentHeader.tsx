"use client"

import type { KeyboardEvent, MouseEvent, ReactNode } from "react"
import { format, isToday } from "date-fns"
import { Calendar, MapPin, Store, Truck, X } from "@/app/components/ui/icons"
import { DatePicker } from "@/app/components/ui/date-picker"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getDateFnsLocale } from "@/app/lib/date-fns-locale"
import type { CheckoutFulfillmentMethod } from "@/app/commerce/delivery-options"

const PHYSICAL_OPTIONS: CheckoutFulfillmentMethod[] = ["pickup", "ship", "dine_in"]
const CONTROL_HEIGHT = "h-14 min-h-14"

type OrderTiming = "now" | "scheduled"
type Tone = "default" | "hero"

const cellClass = (tone: Tone) =>
  tone === "hero"
    ? "shop-fulfillment-cell flex flex-col items-center justify-center gap-1 flex-1 min-w-0 h-12 min-h-12 px-2 rounded-full transition-all select-none"
    : "shop-fulfillment-cell flex flex-col items-center justify-center gap-1 w-[5.5rem] md:w-24 h-12 min-h-12 px-2 rounded-full transition-all select-none"

type SegmentOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

function selectedCellClass(selected: boolean, tone: Tone) {
  if (tone === "hero") {
    return selected
      ? "bg-white text-gray-900 shadow-sm"
      : "text-white/80 hover:text-white"
  }
  return selected
    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
    : "text-muted-foreground hover:text-foreground"
}

function trackClass(tone: Tone) {
  return tone === "hero"
    ? "bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
    : "bg-gray-100 dark:bg-zinc-800/80"
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  tone,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (val: T) => void
  ariaLabel: string
  tone: Tone
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex items-stretch ${CONTROL_HEIGHT} shrink-0 p-1 ${trackClass(tone)} rounded-full gap-1 ${tone === "hero" ? "w-full max-w-[320px]" : "w-fit"}`}
    >
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`${cellClass(tone)} ${selectedCellClass(selected, tone)}`}
          >
            {opt.icon}
            <span className="text-xs font-semibold leading-none truncate max-w-full">
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ShopFulfillmentHeader({
  allowedOptions,
  fulfillment,
  setFulfillment,
  orderTiming,
  setOrderTiming,
  scheduledFor,
  setScheduledFor,
  tone = "default",
  centerAction,
}: {
  allowedOptions: CheckoutFulfillmentMethod[]
  fulfillment: CheckoutFulfillmentMethod
  setFulfillment: (value: CheckoutFulfillmentMethod) => void
  orderTiming: OrderTiming
  setOrderTiming: (value: OrderTiming) => void
  scheduledFor: Date | null
  setScheduledFor: (value: Date | null) => void
  tone?: Tone
  centerAction?: ReactNode
}) {
  const { t, locale } = useLocalization()
  const dateLocale = getDateFnsLocale(locale)

  const fulfillmentOptions = allowedOptions.filter((opt) => PHYSICAL_OPTIONS.includes(opt))
  const showFulfillment = fulfillmentOptions.length > 1
  const showScheduling = fulfillmentOptions.length > 0

  if (!showFulfillment && !showScheduling) return null

  const selectedFulfillment = fulfillmentOptions.includes(fulfillment)
    ? fulfillment
    : fulfillmentOptions[0]
  const isScheduled = orderTiming === "scheduled" && !!scheduledFor

  const fulfillmentSegments: SegmentOption<CheckoutFulfillmentMethod>[] = fulfillmentOptions.map((opt) => {
    if (opt === "pickup") {
      return {
        value: "pickup",
        label: t("shop.fulfillment.pickup") || "Pickup",
        icon: <Store className="w-5 h-5 shrink-0" />,
      }
    }
    if (opt === "dine_in") {
      return {
        value: "dine_in",
        label: t("shop.fulfillment.dineIn") || "Dine-in",
        icon: <MapPin className="w-5 h-5 shrink-0" />,
      }
    }
    return {
      value: "ship",
      label: t("shop.fulfillment.delivery") || "Delivery",
      icon: <Truck className="w-5 h-5 shrink-0" />,
    }
  })

  const scheduleLabel = (() => {
    if (!isScheduled || !scheduledFor) return t("shop.fulfillment.schedule") || "Schedule"
    if (isToday(scheduledFor)) return format(scheduledFor, "p", { locale: dateLocale })
    return format(scheduledFor, "MMM d", { locale: dateLocale })
  })()

  const clearSchedule = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOrderTiming("now")
    setScheduledFor(null)
  }

  const scheduleButton = showScheduling ? (
    <div className="size-14 min-h-14 min-w-14 shrink-0">
      <DatePicker
        date={scheduledFor || undefined}
        setDate={(date: Date) => {
          setScheduledFor(date)
          setOrderTiming("scheduled")
        }}
        showTimePicker
        timeFormat="12h"
        mode="task"
        showEvents
        position="bottom"
        trigger={
          <button
            type="button"
            aria-pressed={isScheduled}
            aria-label={
              isScheduled
                ? scheduleLabel
                : t("shop.fulfillment.schedule") || "Schedule"
            }
            className={`shop-fulfillment-schedule relative size-14 min-h-14 min-w-14 rounded-full shrink-0 flex items-center justify-center transition-all select-none ${
              isScheduled
                ? selectedCellClass(true, tone)
                : `${trackClass(tone)} ${selectedCellClass(false, tone)}`
            }`}
          >
            <Calendar className="w-7 h-7 shrink-0" />
            {isScheduled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={t("shop.fulfillment.now") || "Now"}
                onClick={clearSchedule}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") clearSchedule(e)
                }}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center shadow-sm"
              >
                <X className="w-2.5 h-2.5" />
              </span>
            )}
          </button>
        }
      />
    </div>
  ) : null

  const segment = showFulfillment ? (
    <SegmentedControl
      options={fulfillmentSegments}
      value={selectedFulfillment}
      onChange={setFulfillment}
      ariaLabel={t("checkout.deliveryMethod") || "Delivery Method"}
      tone={tone}
    />
  ) : null

  if (tone === "hero") {
    return (
      <div 
        className="shop-fulfillment-bar flex items-center justify-between md:grid w-full gap-2 min-h-14"
        style={{ gridTemplateColumns: "1fr auto 1fr" }}
      >
        <div className="flex items-center gap-2 min-w-0 min-h-14 w-[320px] max-w-[calc(100%-3.75rem)] md:w-auto md:max-w-none">
          {segment}
          <div className="hidden md:block shrink-0">{scheduleButton}</div>
        </div>
        <div className="hidden md:flex justify-center items-center">{centerAction}</div>
        <div className="shrink-0 md:min-w-0">
          <div className="md:hidden">{scheduleButton}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="shop-fulfillment-bar mb-5 md:mb-6">
      <div className="flex items-center justify-between md:justify-start gap-2 md:gap-5 min-h-14">
        {segment}
        {scheduleButton}
      </div>
    </div>
  )
}
