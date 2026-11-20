import type { SavedPersonResult } from '@/app/people/saved-list-types'

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 4000) : null
}
function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
function url(value: unknown): string | null {
  const candidate = text(value)
  if (!candidate) return null
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null
  } catch { return null }
}

function identity(value: unknown): string | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : null
  return text(value)
}
function matchingCompany(candidate: Record<string, unknown>, company: Record<string, unknown>) {
  const id = identity(company.id)
  const candidateId = identity(candidate.id)
  return id !== null && id === candidateId
}

/** Only project a lead already linked to this member and readable by the actor. */
export function savedPersonProfile(personId: string, linkedLead: unknown): SavedPersonResult {
  const lead = record(linkedLead)
  const raw = record(lead.profile)
  const nested = record(raw.person)
  const candidate = Object.keys(nested).length ? nested : raw
  const verified = identity(candidate.id ?? candidate.external_person_id ?? candidate.person_id) === personId
  const person = verified ? candidate : {}
  const company = typeof lead.company === 'string' ? { name: lead.company } : record(lead.company)
  const position = text(lead.position)
  const roles = verified ? [raw.role, ...(Array.isArray(raw.roles) ? raw.roles : []),
    ...(candidate !== raw && Array.isArray(candidate.roles) ? candidate.roles : [])].map(record) : []
  const eligibleRoles = roles.filter(role => {
    return matchingCompany(record(role.organization), company)
  })
  const role = eligibleRoles.find(item => position && text(item.role_title ?? item.title)?.toLowerCase() === position.toLowerCase())
    ?? (position ? {} : eligibleRoles.find(item => item.is_current === true) ?? eligibleRoles[0] ?? {})
  const matchingOrg = verified ? [record(role.organization), record(raw.organization)]
    .find(org => matchingCompany(org, company)) : undefined
  const organization = { ...matchingOrg, ...company }
  const personLinkedIn = record(person.linkedin_info)
  const companyLinkedIn = record(organization.linkedin_info)
  const industries = Array.isArray(organization.industries) ? organization.industries : []
  return {
    person: {
      id: personId, full_name: text(lead.name) || text(person.full_name) || text(person.name) || personId,
      photo: url(person.photo ?? person.photo_url ?? person.avatar_url),
      location: text(record(person.location).name) || text(person.location),
      headline: text(person.headline) || (Array.isArray(person.headline) ? text(person.headline[0]) : null),
      description: text(person.description),
      linkedin_info: { public_profile_url: url(personLinkedIn.public_profile_url ?? person.linkedin_profile) },
    },
    organization: {
      id: identity(organization.id), name: text(organization.name),
      logo: url(organization.logo ?? organization.logo_url), description: text(organization.description),
      employee_count: numeric(organization.employee_count ?? organization.employees),
      revenue: numeric(organization.revenue), founded_date: text(organization.founded_date),
      industries: industries.map(i => text(i) || text(record(i).name)).filter((i): i is string => Boolean(i)).slice(0, 50),
      website: url(organization.website), linkedin_info: { public_profile_url: url(companyLinkedIn.public_profile_url) },
    },
    role_title: position || text(role.role_title ?? role.title),
    role_description: text(role.role_description ?? role.description),
    start_date: text(role.start_date ?? role.position_start_date),
    end_date: text(role.end_date ?? role.position_end_date),
    is_current: role.is_current === true,
  }
}