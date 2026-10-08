import { getMemberLimit, licensePlan, memberUpgradePayload, requiredLicensePlan, requiredMemberPlan } from "@/lib/license-entitlements"

describe("per-site license entitlements", () => {
  it.each([[0, "commission"], [1, "commission"], [2, "engine"], [5, "engine"], [6, "foundry"], [10, "foundry"], [11, "enterprise"], [1000, "enterprise"]])("requires %s seats to use %s", (seats, plan) => {
    expect(requiredMemberPlan(seats as number)).toBe(plan)
  })

  it("keeps legacy names and free unknowns safe", () => {
    expect(getMemberLimit("toolbox")).toBe(1)
    expect(getMemberLimit("starter")).toBe(5)
    expect(getMemberLimit("startup")).toBe(10)
    expect(getMemberLimit("reactor")).toBeNull()
    expect(licensePlan("unexpected")).toBe("commission")
  })

  it("recommends the next seat, not the current plan", () => {
    expect(memberUpgradePayload("site-a", "engine", 5)).toMatchObject({ kind: "members", current: 5, limit: 5, requiredPlan: "foundry", siteId: "site-a" })
  })

  it("never uses connection add-ons as member seats", () => {
    expect(requiredLicensePlan({ members: 6, socialAccounts: 0, agentChannels: 0, addons: 100 }).plan).toBe("foundry")
  })

  it("shares the add-on pool between social and custom channels", () => {
    expect(requiredLicensePlan({ members: 1, socialAccounts: 4, agentChannels: 2, addons: 1 }).plan).toBe("foundry")
    expect(requiredLicensePlan({ members: 1, socialAccounts: 4, agentChannels: 2, addons: 2 }).plan).toBe("engine")
  })

  it("does not promise that Enterprise includes unlimited connections", () => {
    expect(requiredLicensePlan({ members: 20, socialAccounts: 12, agentChannels: 10 })).toEqual({ plan: "enterprise", missingConnectionAddons: 2 })
  })
})