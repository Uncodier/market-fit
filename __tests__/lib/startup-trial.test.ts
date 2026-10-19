import { effectiveBillingPlan, startupTrialSchema } from "@/lib/billing/startup-trial"
import { countAgentChannels, getRequiredAddons } from "@/lib/billing-limits"
import type { Site } from "@/app/context/site-types"

const start = "2026-10-19T12:00:00.000Z"
const end = "2026-11-03T12:00:00.000Z"
const billing = { plan: "commission", trial_started_at: start, trial_ends_at: end }

it("activates Foundry only within the complete 15-day interval", () => {
  expect(effectiveBillingPlan(billing, Date.parse(start) - 1)).toBe("commission")
  expect(effectiveBillingPlan(billing, Date.parse(start))).toBe("foundry")
  expect(effectiveBillingPlan(billing, Date.parse(end) - 1)).toBe("foundry")
  expect(effectiveBillingPlan(billing, Date.parse(end))).toBe("commission")
})

it("never turns a paid plan into a trial or accepts an unbounded trial", () => {
  for (const plan of ["engine", "foundry", "enterprise"]) {
    expect(effectiveBillingPlan({ ...billing, plan }, Date.parse(start))).toBe(plan)
  }
  for (const input of [null, {}, { ...billing, trial_converted_at: start },
    { ...billing, trial_ends_at: "invalid" },
    { ...billing, trial_ends_at: "2027-11-03T12:00:00.000Z" }]) {
    expect(effectiveBillingPlan(input, Date.parse(start))).toBe("commission")
  }
  expect(effectiveBillingPlan(billing, NaN)).toBe("commission")
})

it("applies trial connection allowances without changing the paid checkout plan", () => {
  jest.useFakeTimers().setSystemTime(Date.parse(start))
  try {
    const site = { billing, settings: {
      social_media: Array.from({ length: 6 }, () => ({ isActive: true })),
      channels: { connections: Array.from({ length: 3 }, () => ({ status: "connected" })) },
    } } as unknown as Site
    expect(getRequiredAddons(site)).toBe(0)
    expect(site.billing?.plan).toBe("commission")
    jest.setSystemTime(Date.parse(end))
    expect(getRequiredAddons(site)).toBe(8)
  } finally { jest.useRealTimers() }
})

const trial = { success: true, state: "active", started_at: start, ends_at: end,
  credits_remaining: 50, server_now: start }

it('counts legacy Voice statuses in admission and add-on demand without admitting other inactive channels', () => {
  jest.useFakeTimers().setSystemTime(Date.parse(start))
  try {
    const site = { billing, settings: { channels: { connections: [
      { type: 'voice', status: 'active' }, { type: 'voice', status: 'synced' },
      { type: 'voice', status: 'connected' }, { type: 'telegram', status: 'active' },
      { type: 'email', status: 'synced' },
    ] } } } as unknown as Site
    expect(countAgentChannels(site)).toBe(3)
    expect(getRequiredAddons(site)).toBe(0)
    jest.setSystemTime(Date.parse(end))
    expect(getRequiredAddons(site)).toBe(3)
  } finally { jest.useRealTimers() }
})

it("validates lifecycle and exposes only the minimal DTO", () => {
  expect(startupTrialSchema.parse({ ...trial, owner_id: "private" })).toEqual(trial)
  expect(startupTrialSchema.safeParse({ ...trial, credits_remaining: 0 }).success).toBe(true)
  for (const invalid of [{ ...trial, credits_remaining: 51 }, { ...trial, credits_remaining: -1 },
    { ...trial, server_now: end }, { ...trial, ends_at: null },
    { ...trial, state: "eligible" }, { ...trial, state: "expired" },
    { ...trial, ends_at: "2026-11-04T12:00:00.000Z" },
    { ...trial, state: "converted", credits_remaining: 1 }]) {
    expect(startupTrialSchema.safeParse(invalid).success).toBe(false)
  }
})