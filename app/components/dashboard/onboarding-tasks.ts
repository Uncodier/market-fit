import type { OnboardingTaskId } from "@/app/components/dashboard/hooks/use-onboarding-validation"

export type OnboardingMode = "inbound" | "outbound" | "ai_tasks"
export type OnboardingTier = "launch" | "later"
export type OnboardingTaskIcon =
  | "code"
  | "settings"
  | "target"
  | "upload"
  | "tag"
  | "mail"
  | "bot"
  | "calendar"
  | "star"
  | "palette"
  | "clock"
  | "credit-card"
  | "users"
  | "file-text"
  | "sparkles"
  | "external-link"
  | "globe"

export interface OnboardingTaskDef {
  id: OnboardingTaskId
  href: string
  estimatedMinutes: number
  tier: OnboardingTier
  modes: OnboardingMode[]
  icon: OnboardingTaskIcon
}

export const ONBOARDING_TASKS: OnboardingTaskDef[] = [
  {
    id: "install_tracking_script",
    href: "/settings?tab=channels",
    estimatedMinutes: 5,
    tier: "launch",
    modes: ["inbound"],
    icon: "code",
  },
  {
    id: "configure_channels",
    href: "/settings?tab=channels",
    estimatedMinutes: 8,
    tier: "launch",
    modes: ["inbound"],
    icon: "settings",
  },
  {
    id: "create_campaign",
    href: "/campaigns",
    estimatedMinutes: 12,
    tier: "launch",
    modes: ["inbound"],
    icon: "target",
  },
  {
    id: "import_leads",
    href: "/people",
    estimatedMinutes: 7,
    tier: "launch",
    modes: ["outbound"],
    icon: "upload",
  },
  {
    id: "fine_tune_segments",
    href: "/segments",
    estimatedMinutes: 10,
    tier: "launch",
    modes: ["outbound"],
    icon: "tag",
  },
  {
    id: "setup_billing",
    href: "/settings?tab=channels",
    estimatedMinutes: 8,
    tier: "launch",
    modes: ["outbound"],
    icon: "mail",
  },
  {
    id: "configure_agents",
    href: "/agents",
    estimatedMinutes: 15,
    tier: "launch",
    modes: ["ai_tasks"],
    icon: "bot",
  },
  {
    id: "create_coordination_task",
    href: "/requirements",
    estimatedMinutes: 6,
    tier: "launch",
    modes: ["ai_tasks"],
    icon: "calendar",
  },
  {
    id: "publish_and_feedback",
    href: "/content",
    estimatedMinutes: 15,
    tier: "launch",
    modes: ["ai_tasks"],
    icon: "star",
  },
  {
    id: "setup_branding",
    href: "/context",
    estimatedMinutes: 10,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "palette",
  },
  {
    id: "set_business_hours",
    href: "/context",
    estimatedMinutes: 3,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "clock",
  },
  {
    id: "pay_first_campaign",
    href: "/billing",
    estimatedMinutes: 4,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "credit-card",
  },
  {
    id: "invite_team",
    href: "/settings?tab=team",
    estimatedMinutes: 5,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "users",
  },
  {
    id: "setup_content",
    href: "/content",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "file-text",
  },
  {
    id: "personalize_customer_journey",
    href: "/context",
    estimatedMinutes: 18,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "sparkles",
  },
  {
    id: "assign_attribution_link",
    href: "/dashboard?tab=traffic",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "external-link",
  },
  {
    id: "complete_requirement",
    href: "/requirements",
    estimatedMinutes: 20,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "target",
  },
  {
    id: "validate_geographic_restrictions",
    href: "/context",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "ai_tasks"],
    icon: "globe",
  },
]

export const ONBOARDING_MODES: OnboardingMode[] = ["inbound", "outbound", "ai_tasks"]

export function isOnboardingMode(value: unknown): value is OnboardingMode {
  return value === "inbound" || value === "outbound" || value === "ai_tasks"
}

export function onboardingModeStorageKey(siteId: string) {
  return `onboarding_mode_${siteId}`
}

export function getLaunchTasks(mode: OnboardingMode): OnboardingTaskDef[] {
  return ONBOARDING_TASKS.filter((task) => task.tier === "launch" && task.modes.includes(mode))
}

export function getLaterTasks(mode: OnboardingMode): OnboardingTaskDef[] {
  return ONBOARDING_TASKS.filter((task) => task.tier === "later" && task.modes.includes(mode))
}

export function getScopedTasks(mode: OnboardingMode): OnboardingTaskDef[] {
  return [...getLaunchTasks(mode), ...getLaterTasks(mode)]
}

export function formatOnboardingTime(minutes: number): string {
  if (minutes <= 0) return "0 min"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}
