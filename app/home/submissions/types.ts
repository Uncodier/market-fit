export type Opportunity = { site_id: string; supplier_id: string | null; supplier_name: string; acting_as_self?: boolean; acting_site_id?: string | null; tender_id: string;
  publication_id: string; version: number; title: string; description: string; currency: string;
  visibility?: string; participation?: string; directly_invited?: boolean;
  participation_deadline: string; opening_at: string; opening_policy: string;
  requirements: { id: string; description: string; quantity: number; unit: string }[] }
export type Submission = { id: string; reference: string; tender_title: string; currency: string;
  net_amount_minor: number; tax_amount_minor: number | null; submitted_at: string }
export type SavedDraft = { publication_id: string; publication_version: number; applicant_key: string;
  updated_at: string; draft_revision: number; reference: string; attempted: boolean;
  opportunity: Opportunity | null; can_resume: boolean }

export async function readPortalJson(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Unable to load supplier activity')
  return data
}