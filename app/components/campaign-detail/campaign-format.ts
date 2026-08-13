import { CampaignPriority, CampaignType } from "@/app/types"
import { formatCurrency } from "@/app/lib/formatters"

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  branding: "Branding",
  product: "Product",
  events: "Events",
  success: "Customer Success",
  account: "Account-Based",
  community: "Community",
  guerrilla: "Guerrilla",
  affiliate: "Affiliate",
  experiential: "Experiential",
  programmatic: "Programmatic",
  performance: "Performance",
  publicRelations: "Public Relations",
}

export const CAMPAIGN_PRIORITY_LABELS: Record<CampaignPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

export function campaignTypeLabel(type?: string | null) {
  if (!type) return "Inbound"
  return CAMPAIGN_TYPE_LABELS[type as CampaignType] || type
}

export function campaignPriorityLabel(priority?: string | null) {
  if (!priority) return "Medium"
  return CAMPAIGN_PRIORITY_LABELS[priority as CampaignPriority] || priority
}

export function formatCampaignBudget(allocated?: number | null, currency = "USD") {
  if (allocated === null || allocated === undefined || allocated <= 0) return null
  return formatCurrency(allocated, currency)
}
