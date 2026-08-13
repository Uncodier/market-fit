import { resolveCheckoutScheduledFor } from "../../app/commerce/checkout-schedule"
import type { BusinessHours } from "../../app/commerce/business-hours"

const hours: BusinessHours[] = [
  {
    name: "Main",
    timezone: "America/New_York",
    days: {
      monday: { enabled: true, start: "09:00", end: "17:00" },
      tuesday: { enabled: true, start: "09:00", end: "17:00" },
      wednesday: { enabled: true, start: "09:00", end: "17:00" },
      thursday: { enabled: true, start: "09:00", end: "17:00" },
      friday: { enabled: true, start: "09:00", end: "17:00" },
      saturday: { enabled: false },
      sunday: { enabled: false },
    },
  },
]

const mondayNoon = new Date("2026-08-03T12:00:00-04:00")
const mondayNight = new Date("2026-08-03T21:30:00-04:00")

describe("resolveCheckoutScheduledFor", () => {
  it("lets POS checkout proceed while force-closed without scheduling", () => {
    const closed = [{ ...hours[0], force_closed: true }]
    expect(
      resolveCheckoutScheduledFor({
        source: "pos",
        businessHours: closed,
        now: mondayNoon,
      }),
    ).toBeUndefined()
  })

  it("lets POS checkout proceed after hours without scheduling", () => {
    expect(
      resolveCheckoutScheduledFor({
        source: "pos",
        businessHours: hours,
        now: mondayNight,
      }),
    ).toBeUndefined()
  })

  it("keeps an explicit POS scheduledFor even when the store is closed", () => {
    const when = "2026-08-03T21:45:00.000Z"
    expect(
      resolveCheckoutScheduledFor({
        source: "pos",
        scheduledFor: when,
        businessHours: [{ ...hours[0], force_closed: true }],
        now: mondayNoon,
      }),
    ).toBe(when)
  })

  it("does not gate sales or quote on store hours", () => {
    const closed = [{ ...hours[0], force_closed: true }]
    expect(
      resolveCheckoutScheduledFor({
        source: "sales",
        businessHours: closed,
        now: mondayNoon,
      }),
    ).toBeUndefined()
    expect(
      resolveCheckoutScheduledFor({
        source: "quote",
        businessHours: closed,
        now: mondayNoon,
      }),
    ).toBeUndefined()
  })

  it("rejects shop scheduled times outside business hours", () => {
    expect(() =>
      resolveCheckoutScheduledFor({
        source: "shop",
        scheduledFor: mondayNight.toISOString(),
        businessHours: hours,
        now: mondayNoon,
      }),
    ).toThrow("The selected scheduled time is outside business hours.")
  })

  it("accepts shop scheduled times inside hours even if currently force-closed", () => {
    const slot = "2026-08-03T16:00:00.000-04:00"
    expect(
      resolveCheckoutScheduledFor({
        source: "shop",
        scheduledFor: slot,
        businessHours: [{ ...hours[0], force_closed: true }],
        now: mondayNoon,
      }),
    ).toBe(slot)
  })
})
