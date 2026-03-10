import { Company } from "@/app/companies/types"
import { Lead } from "@/app/leads/types"

export interface DealContact {
  id: string
  deal_id: string
  lead_id: string
  role: string | null
  is_primary: boolean
  created_at: string
  lead?: Lead | null
}

export interface DealOwner {
  id: string
  deal_id: string
  user_id: string
  created_at: string
  user?: {
    id: string
    email: string
    name?: string
  } | null
}

export interface Deal {
  id: string
  name: string
  amount: number | null
  currency: string
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"
  status: "open" | "won" | "lost"
  company_id: string | null
  company: {
    name?: string
    website?: string
    industry?: string
    [key: string]: any
  } | null
  companies?: {
    name: string
  } | null
  site_id: string
  expected_close_date: string | null
  notes: string | null
  qualification_score: number | null
  qualification_criteria: Record<string, any>
  sales_order_id: string | null
  created_at: string
  updated_at: string
  
  // Relations
  contacts?: DealContact[]
  owners?: DealOwner[]
  next_task?: {
    id: string
    title: string
    scheduled_date: string | null
    type: string | null
  } | null
}

export interface DealFilters {
  stage: string[]
  status: string[]
  assignees: string[]
}

export const DEAL_STAGES = [
  { id: "prospecting", name: "Prospecting" },
  { id: "qualification", name: "Qualification" },
  { id: "proposal", name: "Proposal" },
  { id: "negotiation", name: "Negotiation" },
  { id: "closed_won", name: "Closed Won" },
  { id: "closed_lost", name: "Closed Lost" }
]

export const DEAL_STATUSES = [
  { id: "open", name: "Open" },
  { id: "won", name: "Won" },
  { id: "lost", name: "Lost" }
]

export const STAGE_STYLES = {
  prospecting: "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200",
  qualification: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-200",
  proposal: "bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200",
  negotiation: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200",
  closed_won: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
  closed_lost: "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200"
}

export interface DealWithCompany extends Omit<Deal, 'company'> {
  company_data: Company | null
}
