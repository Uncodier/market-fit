// Campaign types
export type CampaignStatus = 'active' | 'pending' | 'completed';
export type CampaignPriority = 'high' | 'medium' | 'low';
export type CampaignType = 'inbound' | 'outbound' | 'branding' | 'product' | 'events' | 'success' | 'account' | 'community' | 'guerrilla' | 'affiliate' | 'experiential' | 'programmatic' | 'performance' | 'publicRelations';

// KPI types
export type KpiType = 'revenue' | 'conversion' | 'retention' | 'acquisition' | 'engagement' | 'satisfaction' | 'growth' | 'custom';
export type KpiUnit = 'currency' | 'percentage' | 'count' | 'ratio' | 'time' | 'custom';

export interface Kpi {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: KpiType;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any | null;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  trend: number;
  benchmark: number | null;
}

export interface KpiData {
  id: string;
  name: string;
  description: string | null;
  value: number;
  previous_value: number;
  unit: string;
  type: string;
  period_start: string;
  period_end: string;
  segment_id: string | null;
  is_highlighted: boolean;
  target_value: number | null;
  metadata: any | null;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  trend: number;
  benchmark: number | null;
}

export interface Revenue {
  actual: number;
  projected: number;
  estimated: number;
  currency: string;
}

export interface Budget {
  allocated: number;
  remaining: number;
  currency: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  type: 'fixed' | 'variable';
  amount: number;
  description: string;
  category: string;
  date: string;
  currency: string;
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  title: string;
  productName: string;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  leadId: string | null;
  leadName: string | null;
  campaignId: string;
  segmentId: string | null;
  saleDate: string;
  paymentMethod: string;
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSubtask {
  id: string;
  campaignId: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  priority: CampaignPriority;
  status: CampaignStatus;
  dueDate: string;
  assignees: number;
  issues: number;
  revenue: Revenue;
  budget: Budget;
  type: CampaignType;
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  subtasks?: CampaignSubtask[];
  segments?: string[];
  segmentObjects?: Array<{id: string, name: string}>;
  requirements?: string[];
}

// Database model types (for use with Supabase)
export interface CampaignData {
  id: string;
  title: string;
  description: string | null;
  priority: CampaignPriority;
  status: CampaignStatus;
  due_date: string | null;
  assignees: number;
  issues: number;
  revenue: Revenue;
  budget: Budget;
  type: CampaignType;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionData {
  id: string;
  campaign_id: string;
  type: 'fixed' | 'variable';
  amount: number;
  description: string | null;
  category: string;
  date: string;
  currency: string;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SaleData {
  id: string;
  title: string;
  product_name: string | null;
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  lead_id: string | null;
  lead_name?: string | null; // Para cuando se carga con joins
  campaign_id: string;
  segment_id: string | null;
  sale_date: string;
  payment_method: string | null;
  notes: string | null;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignSubtaskData {
  id: string;
  campaign_id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface CampaignSegmentData {
  campaign_id: string;
  segment_id: string;
}

export interface CampaignRequirementData {
  campaign_id: string;
  requirement_id: string;
} 