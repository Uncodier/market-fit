export type OnboardingTaskId =
  | "configure_channels"
  | "install_tracking_script"
  | "set_business_hours"
  | "setup_branding"
  | "setup_billing"
  | "validate_geographic_restrictions"
  | "fine_tune_segments"
  | "create_campaign"
  | "setup_content"
  | "configure_agents"
  | "complete_requirement"
  | "publish_and_feedback"
  | "personalize_customer_journey"
  | "assign_attribution_link"
  | "import_leads"
  | "pay_first_campaign"
  | "invite_team"
  | "create_coordination_task"

export const ALL_TASK_IDS: OnboardingTaskId[] = [
  "configure_channels", "install_tracking_script", "set_business_hours",
  "setup_branding", "setup_billing", "validate_geographic_restrictions",
  "fine_tune_segments", "create_campaign", "setup_content", "configure_agents",
  "complete_requirement", "publish_and_feedback", "personalize_customer_journey",
  "assign_attribution_link", "import_leads", "pay_first_campaign", "invite_team",
  "create_coordination_task"
]

export type OnboardingTasksState = Record<OnboardingTaskId, boolean>
