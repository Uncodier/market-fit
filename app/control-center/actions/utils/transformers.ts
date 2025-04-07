import { 
  type Campaign, 
  type CampaignData, 
  type Transaction, 
  type TransactionData,
  type CampaignSubtask,
  type CampaignSubtaskData,
  type Sale,
  type SaleData
} from "@/app/types"

// Function to transform CampaignData to Campaign
export function transformCampaignData(data: CampaignData): Campaign {
  return {
    id: data.id,
    title: data.title,
    description: data.description || "",
    priority: data.priority,
    status: data.status,
    dueDate: data.due_date || "",
    assignees: data.assignees,
    issues: data.issues,
    revenue: data.revenue,
    budget: data.budget,
    type: data.type,
    siteId: data.site_id,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

// Function to transform TransactionData to Transaction
export function transformTransactionData(data: TransactionData): Transaction {
  return {
    id: data.id,
    campaignId: data.campaign_id,
    type: data.type,
    amount: data.amount,
    description: data.description || "",
    date: data.date,
    currency: data.currency,
    siteId: data.site_id,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

// Function to transform CampaignSubtaskData to CampaignSubtask
export function transformSubtaskData(data: CampaignSubtaskData): CampaignSubtask {
  return {
    id: data.id,
    campaignId: data.campaign_id,
    title: data.title,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

// Function to transform SaleData to Sale
export function transformSaleData(data: SaleData): Sale {
  return {
    id: data.id,
    title: data.title,
    productName: data.product_name || "",
    amount: data.amount,
    status: data.status,
    leadId: data.lead_id,
    leadName: data.lead_name || null,
    campaignId: data.campaign_id,
    segmentId: data.segment_id,
    saleDate: data.sale_date,
    paymentMethod: data.payment_method || "other",
    siteId: data.site_id,
    userId: data.user_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  }
}

// UUID validation utility
export function isValidUUID(str: string): boolean {
  // UUID pattern: 8-4-4-4-12 hex digits
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
} 