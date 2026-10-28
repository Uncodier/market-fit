export type Opportunity = { site_id: string; supplier_id: string; supplier_name: string; tender_id: string;
  publication_id: string; version: number; title: string; description: string; currency: string;
  participation_deadline: string; opening_at: string; opening_policy: string;
  requirements: { id: string; description: string; quantity: number; unit: string }[] }
export type Submission = { id: string; reference: string; tender_title: string; currency: string;
  net_amount_minor: number; tax_amount_minor: number; submitted_at: string }

export async function readPortalJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to load supplier activity')
  return data
}