import { createClient } from "@/lib/supabase/client"
import { getLeads } from '@/app/leads/actions'
import {
  ContextLead,
  ContextContent,
  ContextRequirement,
  ContextTask,
  ContextCampaign,
  ContextQuotation,
  ContextDeal,
  ContextRecord
} from '@/app/services/context-entities.service'

export async function fetchContextLeads(siteId: string, limit: number = 20): Promise<ContextLead[]> {
  const result = await getLeads(siteId)
  if (result.error) throw new Error(result.error)
  
  return (result.leads || []).slice(0, limit).map((lead: any) => ({
    id: lead.id,
    name: lead.name || '',
    email: lead.email || '',
    company: lead.company?.name || lead.companies?.name || '',
    position: lead.position || '',
    status: lead.status || '',
    created_at: lead.created_at
  }))
}

export async function fetchContextContents(siteId: string, query: string = "", limit: number = 20): Promise<ContextContent[]> {
  const supabase = createClient()
  let q = supabase
    .from('content')
    .select('id, title, description, type, status, created_at')
    .eq('site_id', siteId)
    .neq('status', 'published')
    
  if (query) {
    const quoteLogicValue = (value: string) => `"${value.replace(/\"/g, '\"\"')}"`
    const pattern = `%${query}%`
    q = q.or(`title.ilike.${quoteLogicValue(pattern)},description.ilike.${quoteLogicValue(pattern)},type.ilike.${quoteLogicValue(pattern)}`)
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  
  if (error && error.code === 'PGRST116') return []
  if (error) throw error
  
  return data?.map(content => ({
    id: content.id,
    title: content.title || '',
    description: content.description || '',
    type: content.type || '',
    status: content.status || '',
    created_at: content.created_at
  })) || []
}

export async function fetchContextRequirements(siteId: string, limit: number = 20): Promise<ContextRequirement[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('requirements')
    .select('id, title, description, status, priority, completion_status, created_at')
    .eq('site_id', siteId)
    .neq('completion_status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(req => ({
    id: req.id,
    title: req.title || '',
    description: req.description || '',
    status: req.status || '',
    priority: req.priority || '',
    completion_status: req.completion_status || '',
    created_at: req.created_at
  })) || []
}

export async function fetchContextTasks(siteId: string, limit: number = 20): Promise<ContextTask[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('id, serial_id, title, description, status, type, priority, created_at')
    .eq('site_id', siteId)
    .not('status', 'in', '(failed,canceled,completed)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(task => ({
    id: task.id,
    serial_id: task.serial_id || '',
    title: task.title || '',
    description: task.description || '',
    status: task.status || '',
    type: task.type || '',
    priority: task.priority || '',
    created_at: task.created_at
  })) || []
}

export async function fetchContextCampaigns(siteId: string, limit: number = 20): Promise<ContextCampaign[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, title, description, status, priority, type, created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(campaign => ({
    id: campaign.id,
    title: campaign.title || '',
    description: campaign.description || '',
    status: campaign.status || '',
    priority: campaign.priority || '',
    type: campaign.type || '',
    created_at: campaign.created_at
  })) || []
}

export async function fetchContextQuotations(siteId: string, limit: number = 20): Promise<ContextQuotation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('quotations')
    .select('id, status, total, currency, created_at, lead:leads(name), deal:deals!quotations_deal_id_fkey(name)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(quote => {
    const leadName = (quote.lead && !Array.isArray(quote.lead)) ? quote.lead.name : '';
    const dealName = (quote.deal && !Array.isArray(quote.deal)) ? quote.deal.name : '';
    return {
      id: quote.id,
      title: dealName || leadName || `Quote ${quote.id.substring(0,8)}`,
      status: quote.status || '',
      total: Number(quote.total) || 0,
      currency: quote.currency || 'USD',
      created_at: quote.created_at,
      leadName
    }
  }) || []
}

export async function fetchContextDeals(siteId: string, limit: number = 20): Promise<ContextDeal[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deals')
    .select('id, name, stage, amount, currency, created_at, company:companies(name)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(deal => {
    const companyName = (deal.company && !Array.isArray(deal.company)) ? deal.company.name : '';
    return {
      id: deal.id,
      name: deal.name || '',
      stage: deal.stage || '',
      amount: deal.amount ? Number(deal.amount) : null,
      currency: deal.currency || 'USD',
      created_at: deal.created_at,
      companyName
    }
  }) || []
}

export async function fetchContextRecords(siteId: string, limit: number = 20): Promise<ContextRecord[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('records')
    .select('id, title, description, status, created_at, category:record_categories(name)')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error && error.code === 'PGRST116') return []
  if (error) throw error

  return data?.map(record => {
    let categoryObj = null
    if (record.category && !Array.isArray(record.category)) {
      categoryObj = { name: record.category.name }
    }
    return {
      id: record.id,
      title: record.title || '',
      description: record.description || '',
      status: record.status || '',
      category: categoryObj,
      created_at: record.created_at
    }
  }) || []
}
