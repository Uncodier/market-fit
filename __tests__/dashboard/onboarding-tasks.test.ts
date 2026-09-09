import {
  ONBOARDING_TASKS,
  formatOnboardingTime,
  getLaunchTasks,
  getLaterTasks,
  getScopedTasks,
  isOnboardingMode,
} from "@/app/components/dashboard/onboarding-tasks"

describe("onboarding task catalog", () => {
  it("keeps 18 unique task ids", () => {
    const catalogIds = ONBOARDING_TASKS.map((task) => task.id)
    expect(new Set(catalogIds).size).toBe(19)
    expect(catalogIds.sort()).toEqual([
      "add_catalog_items",
      "assign_attribution_link",
      "configure_channels",
      "configure_store",
      "create_campaign",
      "create_workflows",
      "fine_tune_segments",
      "import_leads",
      "install_tracking_script",
      "invite_team",
      "pay_first_campaign",
      "personalize_customer_journey",
      "set_business_hours",
      "setup_billing",
      "setup_branding",
      "setup_content",
      "setup_content_flows",
      "take_guided_tour",
      "validate_geographic_restrictions",
    ])
  })

  it("keeps three launch tasks per mode and shared later tasks", () => {
    expect(getLaunchTasks("inbound").map((task) => task.id)).toEqual([
      "take_guided_tour",
      "install_tracking_script",
      "configure_channels",
      "create_campaign",
    ])
    expect(getLaunchTasks("outbound").map((task) => task.id)).toEqual([
      "take_guided_tour",
      "import_leads",
      "fine_tune_segments",
      "setup_billing",
    ])
    expect(getLaunchTasks("automation").map((task) => task.id)).toEqual([
      "take_guided_tour",
      "configure_channels",
      "create_workflows",
      "setup_content_flows",
    ])
    expect(getLaunchTasks("ecommerce").map((task) => task.id)).toEqual([
      "take_guided_tour",
      "install_tracking_script",
      "setup_billing",
      "configure_store",
      "add_catalog_items",
    ])
    expect(getLaterTasks("inbound")).toHaveLength(8)
    expect(getScopedTasks("inbound")).toHaveLength(12)
  })

  it("formats remaining time", () => {
    expect(formatOnboardingTime(0)).toBe("0 min")
    expect(formatOnboardingTime(12)).toBe("12 min")
    expect(formatOnboardingTime(60)).toBe("1h")
    expect(formatOnboardingTime(75)).toBe("1h 15m")
  })

  it("validates stored mode values", () => {
    expect(isOnboardingMode("inbound")).toBe(true)
    expect(isOnboardingMode("all")).toBe(false)
  })
})
