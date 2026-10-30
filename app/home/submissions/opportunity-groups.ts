import { applicantKey } from './applicant-picker'
import type { Opportunity } from './types'

export function groupOpportunities(rows: Opportunity[]) {
  const choices = new Map<string, Opportunity[]>()
  const publicRows = new Map<string, Opportunity>()
  const restricted: Opportunity[] = []
  for (const row of rows) {
    if (row.visibility === 'public' && row.participation === 'open') {
      const applicants = choices.get(row.publication_id) ?? []
      if (!applicants.some(item => applicantKey(item) === applicantKey(row))) applicants.push(row)
      choices.set(row.publication_id, applicants)
      if (!publicRows.has(row.publication_id) || applicantKey(row) === 'personal') {
        publicRows.set(row.publication_id, row)
      }
    } else {
      restricted.push(row)
    }
  }
  return { public: [...publicRows.values()], restricted, choices }
}