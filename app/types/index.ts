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

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
  notes?: string;
}

export interface Sale {
  id: string;
  title: string;
  description?: string;
  productName: string;
  productType?: string | null;
  productDetails?: any;
  amount: number;
  amount_due: number;
  currency?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  leadId: string | null;
  leadName: string | null;
  campaignId: string | null;
  segmentId: string | null;
  saleDate: string;
  paymentMethod: string;
  paymentDetails?: any;
  payments?: Payment[];
  invoiceNumber?: string;
  referenceCode?: string;
  externalId?: string;
  source: 'retail' | 'online';
  channel?: string;
  notes?: string;
  tags?: string[];
  siteId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  commandId?: string;
}

export interface SaleOrderItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
  subtotal: number;
}

export interface SaleOrder {
  id: string;
  saleId: string;
  orderNumber: string;
  items: SaleOrderItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleOrderData {
  id: string;
  sale_id: string;
  order_number: string;
  items: SaleOrderItem[]; // stored as JSONB in the database
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at: string;
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
  metadata?: {
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  };
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
  metadata?: any;
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
  product_type: string | null;
  amount: number;
  amount_due: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  lead_id: string | null;
  lead_name?: string | null; // Para cuando se carga con joins
  campaign_id: string | null;
  segment_id: string | null;
  sale_date: string;
  payment_method: string | null;
  payments?: Payment[];
  source: 'retail' | 'online';
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

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  site_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCategory {
  task_id: string;
  category_id: string;
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  attachments: any[]
  created_at: string
  updated_at: string
  is_private: boolean
  files: Array<{
    name: string
    url: string
    size: number
    type: string
  }>
  cta?: {
    primary_action: {
      title: string
      url: string
    }
  }
  profiles?: {
    id: string
    name: string
    avatar_url?: string
  }
}

export interface Task {
  id: string
  serial_id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee?: string
  type?: string
  priority: number
  address?: any
  site_id: string
  created_at: string
  updated_at: string
  leads?: {
    id: string
    name: string
  }
  assignee_details?: {
    id: string
    name: string
  }
  comments?: TaskComment[]
} 