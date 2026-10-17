import { formatDeliveryTime } from "@/app/commerce/delivery-time"
import { localeMessages } from "@/app/context/locale-catalog"

it("preserves the existing delivery-time contract without a translator", () => {
  expect(formatDeliveryTime()).toBeNull()
  expect(formatDeliveryTime({})).toBeNull()
  expect(formatDeliveryTime({ delivery_time_min: 10, delivery_time_max: 20 })).toBe("10–20 min")
  expect(formatDeliveryTime({ delivery_time_min: 10 })).toBe("10 min")
  expect(formatDeliveryTime({ delivery_time_max: 20 })).toBe("Up to 20 min")
})

it.each(["en", "es", "fr", "de", "ja"] as const)("localizes all delivery-time variants in %s", (locale) => {
  const messages = localeMessages[locale]
  const t = (key: string, params?: Record<string, string | number>) => Object.entries(params || {}).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)), messages[key],
  )
  expect(formatDeliveryTime({ delivery_time_min: 10, delivery_time_max: 20 }, t)).toBe(t("commerce.deliveryTime.range", { min: 10, max: 20 }))
  expect(formatDeliveryTime({ delivery_time_min: 10 }, t)).toBe(t("commerce.deliveryTime.single", { minutes: 10 }))
  expect(formatDeliveryTime({ delivery_time_max: 20 }, t)).toBe(t("commerce.deliveryTime.upTo", { minutes: 20 }))
})