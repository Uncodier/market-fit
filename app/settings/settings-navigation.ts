import type { QuickNavSection } from "@/app/components/ui/quick-nav";
import type { TabItem } from "@/app/components/ui/responsive-tabs-list";

// Section configurations for quick navigation
export const getGeneralSections = (t: (key: string) => string): QuickNavSection[] => [
  {
    id: "site-information",
    title: t("settings.nav.siteInfo") || "Site Information",
  },
  {
    id: "web-resources",
    title: t("settings.nav.webResources") || "Web Resources",
  },
];

export const getCompanySections = (t: (key: string) => string): QuickNavSection[] => [
  {
    id: "company-profile",
    title: t("settings.nav.companyProfile") || "Company Profile",
  },
  {
    id: "office-locations",
    title: t("settings.nav.officeLocations") || "Office Locations",
    children: [],
  },
  {
    id: "service-available-restrictions",
    title:
      t("settings.nav.serviceRestrictions") || "Service Available Restrictions",
    children: [],
  },
  {
    id: "service-exclusions-addresses",
    title:
      t("settings.nav.serviceExclusions") || "Service Exclusions Addresses",
    children: [],
  },
  {
    id: "business-hours",
    title: t("settings.nav.businessHours") || "Business Hours",
    children: [],
  },
  {
    id: "goals-quarterly",
    title: t("settings.nav.goals") || "Business Goals",
    children: [
      {
        id: "goals-quarterly",
        title: t("settings.nav.goals.quarterly") || "Quarter Goals",
      },
      {
        id: "goals-yearly",
        title: t("settings.nav.goals.yearly") || "Year Goals",
      },
      {
        id: "goals-five-year",
        title: t("settings.nav.goals.fiveYear") || "5 Year Goals",
      },
      {
        id: "goals-ten-year",
        title: t("settings.nav.goals.tenYear") || "10 Year Goals",
      },
    ],
  },
  {
    id: "swot-strengths",
    title: t("settings.nav.swot") || "SWOT Analysis",
    children: [
      {
        id: "swot-strengths",
        title: t("settings.nav.swot.strengths") || "Strengths",
      },
      {
        id: "swot-weaknesses",
        title: t("settings.nav.swot.weaknesses") || "Weaknesses",
      },
      {
        id: "swot-opportunities",
        title: t("settings.nav.swot.opportunities") || "Opportunities",
      },
      {
        id: "swot-threats",
        title: t("settings.nav.swot.threats") || "Threats",
      },
    ],
  },
];

export const getMarketplaceSections = (
  t: (key: string) => string,
): QuickNavSection[] => [
  { id: "shop-hero", title: t("settings.nav.shopHero") || "Storefront Hero" },
  {
    id: "shop-trust",
    title: t("settings.nav.shopTrust") || "Trust & Policies",
  },
];

export const getVisitsSections = (t: (key: string) => string): QuickNavSection[] => [
  {
    id: "visits-channels",
    title: t("settings.nav.visitsChannels") || "Visit channels",
  },
  { id: "visits-terms", title: t("settings.nav.visitsTerms") || "Visit Terms" },
];

export const getChannelsSections = (
  t: (key: string) => string,
  channels: QuickNavSection[] = [],
): QuickNavSection[] => [
  { id: "support-channels", title: "Support Channels", children: channels },
  {
    id: "website-channel",
    title: t("settings.nav.websiteChannel") || "Website Channel",
  },
];

export const getInitialSocialSections = (
  t: (key: string) => string,
): QuickNavSection[] => [
  {
    id: "social-networks-section",
    title: t("settings.nav.socialNetworks") || "Social Networks",
    children: [],
  },
];

export const getInitialTeamSections = (
  t: (key: string) => string,
): QuickNavSection[] => [
  {
    id: "team-members",
    title: t("settings.nav.teamMembers") || "Team Members",
    children: [],
  },
];

export const getInitialCopywritingSections = (
  t: (key: string) => string,
): QuickNavSection[] => [
  {
    id: "copywriting-collection",
    title: t("settings.nav.copySequences") || "Copy Sequences",
    children: [],
  },
];

export const getActivitiesSections = (
  t: (key: string) => string,
): QuickNavSection[] => [
  {
    id: "activities",
    title: t("settings.nav.activities") || "AI Activities",
    children: [
      {
        id: "activity-daily_resume_and_stand_up",
        title:
          t("settings.nav.activity.dailyResume") || "Daily Resume and Stand Up",
      },
      {
        id: "activity-local_lead_generation",
        title: t("settings.nav.activity.localLead") || "Local Lead Generation",
      },
      {
        id: "activity-icp_lead_generation",
        title: t("settings.nav.activity.icpLead") || "ICP Lead Generation",
      },
      {
        id: "activity-leads_initial_cold_outreach",
        title:
          t("settings.nav.activity.leadsCold") || "Leads Initial Cold Outreach",
      },
      {
        id: "activity-leads_follow_up",
        title: t("settings.nav.activity.leadsFollowUp") || "Leads Follow Up",
      },
      {
        id: "activity-email_sync",
        title: t("settings.nav.activity.emailSync") || "Email Sync",
      },
      {
        id: "activity-assign_leads_to_team",
        title: t("settings.nav.activity.assignLeads") || "Assign Leads to Team",
      },
      {
        id: "activity-notify_team_on_inbound_conversations",
        title:
          t("settings.nav.activity.notifyTeam") ||
          "Notify Team on Inbound Conversations",
      },
      {
        id: "activity-supervise_conversations",
        title:
          t("settings.nav.activity.superviseConversations") ||
          "Supervise Conversations",
      },
    ],
  },
];

export const getCalendarSections = (t: (key: string) => string): QuickNavSection[] => [
  { id: "calendars", title: t("settings.nav.calendars") || "Calendars" },
];

export const getSecretsSections = (t: (key: string) => string): QuickNavSection[] => [
  { id: "secrets", title: t("settings.nav.secrets") || "Secrets & Envs" },
];

export const getPrintersSections = (t: (key: string) => string): QuickNavSection[] => [
  {
    id: "printers",
    title: t("settings.nav.printers") || "Printers",
    children: [],
  },
];

export const getSettingsTabs = (t: (key: string) => string): TabItem[] => [
    {
      value: "general",
      label: t("settings.tabs.general") || "General Settings",
    },
    { value: "company", label: t("settings.tabs.company") || "Company" },
    {
      value: "marketplace",
      label: t("settings.tabs.marketplace") || "Marketplace",
    },
    { value: "tenders", label: t("procurement.workflow.tender.tenders") || "Tenders" },
    { value: "visits", label: t("settings.tabs.visits") || "Visits" },
    {
      value: "channels",
      label: t("settings.tabs.channels") || "Agent Channels",
    },
    { value: "team", label: t("settings.tabs.team") || "Team" },
    { value: "calendar", label: t("settings.tabs.calendar") || "Calendar" },
    { value: "secrets", label: t("settings.tabs.secrets") || "Secrets" },
    { value: "printers", label: t("settings.tabs.printers") || "Printers" },
    {
      value: "social",
      label: t("settings.nav.socialNetworks") || "Social Networks",
    },
];

export function resolveSettingsSegment(tab: string | null): string | null {
  if (tab === "procurement") return "tenders";
  return tab && ["general", "company", "channels", "team", "activities", "social", "calendar", "secrets", "marketplace", "visits", "printers", "tenders"].includes(tab) ? tab : null;
}
