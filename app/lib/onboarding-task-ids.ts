export type OnboardingTaskId =
  | "take_guided_tour"
  | "configure_channels"
  | "install_tracking_script"
  | "set_business_hours"
  | "setup_branding"
  | "setup_billing"
  | "validate_geographic_restrictions"
  | "fine_tune_segments"
  | "create_campaign"
  | "setup_content"
  | "configure_store"
  | "add_catalog_items"
  | "create_workflows"
  | "setup_content_flows"
  | "personalize_customer_journey"
  | "assign_attribution_link"
  | "import_leads"
  | "pay_first_campaign"
  | "invite_team"

export const ALL_TASK_IDS: OnboardingTaskId[] = [
  "take_guided_tour", "configure_channels", "install_tracking_script", "set_business_hours",
  "setup_branding", "setup_billing", "validate_geographic_restrictions",
  "fine_tune_segments", "create_campaign", "setup_content", "configure_store",
  "add_catalog_items", "create_workflows", "setup_content_flows", "personalize_customer_journey",
  "assign_attribution_link", "import_leads", "pay_first_campaign", "invite_team"
]

export type OnboardingTasksState = Record<OnboardingTaskId, boolean>
