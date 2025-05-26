export interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: {
    name?: string
    website?: string
    industry?: string
    size?: string
    annual_revenue?: string
    founded?: string
    description?: string
    address?: {
      street?: string
      city?: string
      state?: string
      zipcode?: string
      country?: string
      [key: string]: string | undefined
    }
    [key: string]: any
  } | null
  position: string | null
  segment_id: string | null
  campaign_id: string | null
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
  created_at: string
  origin: string | null
  birthday: string | null
  language: string | null
  social_networks: {
    linkedin?: string
    twitter?: string
    facebook?: string
    instagram?: string
    tiktok?: string
    youtube?: string
    whatsapp?: string
    pinterest?: string
    [key: string]: string | undefined
  } | null
  address: {
    street?: string
    city?: string
    state?: string
    zipcode?: string
    country?: string
    [key: string]: string | undefined
  } | null
  notes: string | null
}

export interface LeadFilters {
  status: string[]
  segments: string[]
  origin: string[]
}

export interface Segment {
  id: string
  name: string
}

export interface JourneyEvent {
  id: string
  title: string
  description: string
  date: string
  status: "completed" | "in_progress" | "pending" | "failed"
  type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"
  stage: "awareness" | "consideration" | "decision" | "purchase" | "retention" | "referral"
  amount?: number
}

// Helper type for events with amount
export interface JourneyEventWithAmount extends JourneyEvent {
  amount: number
}

// Helper for typeguard
export function hasAmount(event: JourneyEvent): event is JourneyEventWithAmount {
  return 'amount' in event && typeof event.amount === 'number';
}

// Task collection for customer journey - replacing the mock journey events
export interface Task {
  id: string
  serial_id: string
  lead_id: string
  title: string
  description: string
  created_at: string
  scheduled_date: string
  completed_date?: string
  status: "completed" | "in_progress" | "pending" | "failed"
  type: "website_visit" | "demo" | "meeting" | "email" | "call" | "quote" | "contract" | "payment" | "referral" | "feedback"
  stage: "awareness" | "consideration" | "decision" | "purchase" | "retention" | "referral"
  amount?: number
  assignee?: string
  notes?: string
  priority: number
  address?: any
}

export interface TaskFilters {
  status: string[]
  type: string[]
  stage: string[]
  date_range?: {
    start: string
    end: string
  }
}

export const TASK_TYPES = [
  { id: "website_visit", name: "Website Visit", icon: "Eye" },
  { id: "demo", name: "Product Demo", icon: "PlayCircle" },
  { id: "meeting", name: "Meeting", icon: "Users" },
  { id: "email", name: "Email", icon: "Mail" },
  { id: "call", name: "Call", icon: "Phone" },
  { id: "quote", name: "Quote", icon: "FileText" },
  { id: "contract", name: "Contract", icon: "FileText" },
  { id: "payment", name: "Payment", icon: "Tag" },
  { id: "referral", name: "Referral", icon: "User" },
  { id: "feedback", name: "Feedback", icon: "MessageSquare" }
]

export const JOURNEY_STAGES = [
  { id: "awareness", label: "Awareness" },
  { id: "consideration", label: "Consideration" },
  { id: "decision", label: "Decision" },
  { id: "purchase", label: "Purchase" },
  { id: "retention", label: "Retention" },
  { id: "referral", label: "Referral" }
]

export const TASK_STATUSES = [
  { id: 'pending', name: 'Pending' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'completed', name: 'Completed' },
  { id: 'failed', name: 'Failed' }
]

export const STATUS_STYLES = {
  new: "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200",
  contacted: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200",
  qualified: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-200",
  converted: "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200",
  lost: "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200"
}

export const LEAD_STATUSES = [
  { id: 'new', name: 'New' },
  { id: 'contacted', name: 'Contacted' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'converted', name: 'Converted' },
  { id: 'lost', name: 'Lost' }
] 