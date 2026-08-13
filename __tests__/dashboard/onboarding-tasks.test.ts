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
    expect(new Set(catalogIds).size).toBe(18)
    expect(catalogIds.sort()).toEqual([
      "assign_attribution_link",
      "complete_requirement",
      "configure_agents",
      "configure_channels",
      "create_campaign",
      "create_coordination_task",
      "fine_tune_segments",
      "import_leads",
      "install_tracking_script",
      "invite_team",
      "pay_first_campaign",
      "personalize_customer_journey",
      "publish_and_feedback",
      "set_business_hours",
      "setup_billing",
      "setup_branding",
      "setup_content",
      "validate_geographic_restrictions",
    ])
  })

  it("keeps three launch tasks per mode and shared later tasks", () => {
    expect(getLaunchTasks("inbound").map((task) => task.id)).toEqual([
      "install_tracking_script",
      "configure_channels",
      "create_campaign",
    ])
    expect(getLaunchTasks("outbound").map((task) => task.id)).toEqual([
      "import_leads",
      "fine_tune_segments",
      "setup_billing",
    ])
    expect(getLaunchTasks("ai_tasks").map((task) => task.id)).toEqual([
      "configure_agents",
      "create_coordination_task",
      "publish_and_feedback",
    ])
    expect(getLaterTasks("inbound")).toHaveLength(9)
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
