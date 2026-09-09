import type { OnboardingTaskId } from "@/app/components/dashboard/hooks/use-onboarding-validation"

export type OnboardingMode = "inbound" | "outbound" | "automation" | "ecommerce"
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
  | "shopping-cart"
  | "zap"

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
    id: "take_guided_tour",
    href: "#",
    estimatedMinutes: 2,
    tier: "launch",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "globe",
  },
  {
    id: "install_tracking_script",
    href: "/settings?tab=channels",
    estimatedMinutes: 5,
    tier: "launch",
    modes: ["inbound", "ecommerce"],
    icon: "code",
  },
  {
    id: "configure_channels",
    href: "/settings?tab=channels",
    estimatedMinutes: 8,
    tier: "launch",
    modes: ["inbound", "automation"],
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
    modes: ["outbound", "ecommerce"],
    icon: "mail",
  },
  {
    id: "configure_store",
    href: "/settings?tab=store",
    estimatedMinutes: 15,
    tier: "launch",
    modes: ["ecommerce"],
    icon: "shopping-cart",
  },
  {
    id: "add_catalog_items",
    href: "/catalog",
    estimatedMinutes: 10,
    tier: "launch",
    modes: ["ecommerce"],
    icon: "tag",
  },
  {
    id: "create_workflows",
    href: "/robots?mode=workflow",
    estimatedMinutes: 15,
    tier: "launch",
    modes: ["automation"],
    icon: "zap",
  },
  {
    id: "setup_content_flows",
    href: "/requirements",
    estimatedMinutes: 10,
    tier: "launch",
    modes: ["automation"],
    icon: "file-text",
  },
  {
    id: "setup_branding",
    href: "/context",
    estimatedMinutes: 10,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "palette",
  },
  {
    id: "set_business_hours",
    href: "/context",
    estimatedMinutes: 3,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "clock",
  },
  {
    id: "pay_first_campaign",
    href: "/billing",
    estimatedMinutes: 4,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "credit-card",
  },
  {
    id: "invite_team",
    href: "/settings?tab=team",
    estimatedMinutes: 5,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "users",
  },
  {
    id: "setup_content",
    href: "/content",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "automation"],
    icon: "file-text",
  },
  {
    id: "personalize_customer_journey",
    href: "/context",
    estimatedMinutes: 18,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "sparkles",
  },
  {
    id: "assign_attribution_link",
    href: "/dashboard?tab=traffic",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "external-link",
  },
  {
    id: "validate_geographic_restrictions",
    href: "/context",
    estimatedMinutes: 8,
    tier: "later",
    modes: ["inbound", "outbound", "automation", "ecommerce"],
    icon: "globe",
  },
]

export const ONBOARDING_MODES: OnboardingMode[] = ["inbound", "outbound", "automation", "ecommerce"]

export function isOnboardingMode(value: unknown): value is OnboardingMode {
  return value === "inbound" || value === "outbound" || value === "automation" || value === "ecommerce"
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
