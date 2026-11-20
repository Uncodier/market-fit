import type { SavedListMember, SavedListSnapshot } from '@/app/people/saved-list-types'

export const listId = '11111111-1111-4111-8111-111111111111'
export const siteId = '22222222-2222-4222-8222-222222222222'
export const leadId = '33333333-3333-4333-8333-333333333333'
export function savedMember(personId = '42', name = 'Alice'): SavedListMember {
  return {
    personId, processing: 'completed', outcome: 'matched', lead: { id: leadId, name },
    result: {
      person: { id: personId, full_name: name, photo: null, location: 'Mexico', headline: 'Manufacturing leader',
        description: null, linkedin_info: { public_profile_url: null } },
      organization: { id: 'company-1', name: 'Factory', logo: null, description: null, employee_count: 150,
        revenue: null, founded_date: null, industries: ['Manufacturing'], website: null,
        linkedin_info: { public_profile_url: null } },
      role_title: 'Director', role_description: null, start_date: null, end_date: null, is_current: true,
    },
  }
}
export function savedSnapshot(overrides: Partial<SavedListSnapshot> = {}): SavedListSnapshot {
  return { id: listId, siteId, name: 'Manufactura', status: 'pending', total: 1, completed: 1,
    members: [savedMember()], page: 1, pageSize: 25, ...overrides }
}