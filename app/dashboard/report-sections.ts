export const REPORTS = {
  performance: {
    title: "Performance",
    sections: [
      { id: "outcomes", label: "Outcomes", description: "Contacted leads, conversations, meetings and sales over the selected period." },
      { id: "operations", label: "Operations", description: "Task delivery, approved content, completed requirements and customer activity." },
      { id: "usage", label: "AI usage", description: "Token consumption, generated images and video minutes. Usage is not a monetary cost." },
    ],
  },
  overview: {
    title: "Business overview",
    sections: [
      { id: "summary", label: "Summary", description: "Revenue, active customers and commercial activity for the selected period. Active segment counts cover the entire site." },
      { id: "economics", label: "Unit economics", description: "Customer value, acquisition costs and return on investment." },
      { id: "activity", label: "Activity", description: "Recent commercial activity and engagement trends. The activity feed covers all segments." },
    ],
  },
  analytics: {
    title: "Analytics",
    sections: [
      { id: "distribution", label: "Distribution", description: "Lead attribution and recorded sale amounts by creation date. Sales include all statuses; these are not paid-revenue totals." },
      { id: "customers", label: "Customer cohorts", description: "Repeat purchases and recorded engagement by the first confirmed sale observed in the selected window. This is not lifetime or paid-invoice retention." },
      { id: "leads", label: "Lead cohorts", description: "Recorded engagement for leads created in the selected window. Compare cohorts at the same age; incomplete weeks are not scored." },
    ],
  },
  traffic: {
    title: "Traffic",
    sections: [
      { id: "summary", label: "Acquisition", description: "Sessions, conversion, popular pages and referral sources. Session data covers all segments." },
      { id: "audience", label: "Audience", description: "Understand visitor locations, devices and browsers. Session data covers all segments." },
      { id: "sessions", label: "Sessions", description: "Explore individual sessions and recorded events. Session data covers all segments." },
    ],
  },
  sales: {
    title: "Sales",
    sections: [
      { id: "summary", label: "Summary", description: "Sales totals, order value and revenue trends for the selected period." },
      { id: "channels", label: "Channels", description: "Compare online and retail sales and their contribution to revenue." },
      { id: "categories", label: "Categories", description: "Category-level sales and comparison with the preceding period." },
    ],
  },
  costs: {
    title: "Costs",
    sections: [
      { id: "summary", label: "Summary", description: "Cost trends, spending distribution and revenue-to-cost efficiency." },
      { id: "categories", label: "Categories", description: "Detailed spending by category and comparison with the preceding period." },
    ],
  },
  social: {
    title: "Social",
    sections: [
      { id: "summary", label: "Engagement", description: "Latest accumulated metrics for posts published in the selected period, not daily activity. Undated posts are excluded. All segments are included." },
      { id: "networks", label: "Networks & audience", description: "Reported account metrics and synchronized comment authors, with source coverage shown explicitly. All segments are included." },
      { id: "posts", label: "Top posts", description: "Sort and explore dated posts by their latest stored metrics. Missing metrics are not zero activity. All segments are included." },
    ],
  },
} as const

export type ReportId = keyof typeof REPORTS
export type ReportSection<T extends ReportId> = (typeof REPORTS)[T]["sections"][number]["id"]

export function isReportId(value: string | null): value is ReportId {
  return value !== null && Object.prototype.hasOwnProperty.call(REPORTS, value)
}

export function getReportSection<T extends ReportId>(report: T, value: string | null): ReportSection<T> {
  const sections = REPORTS[report].sections
  return (sections.find((section) => section.id === value)?.id ?? sections[0].id) as ReportSection<T>
}

export function reportSectionUrl(search: string, report: ReportId, section: string): string {
  const params = new URLSearchParams(search)
  params.set("tab", report)
  params.set("section", getReportSection(report, section))
  return `/dashboard?${params.toString()}`
}