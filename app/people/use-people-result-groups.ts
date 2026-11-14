import { useMemo } from "react"
import type { PeoplePageState } from "./use-people-page-state"

type Dependencies = Pick<PeoplePageState, "searchResults" | "setExpandedGroups">

export function usePeopleResultGroups(dependencies: Dependencies) {
  const {
    searchResults,
    setExpandedGroups,
  } = dependencies
  // Group results by person and company (same person.id and organization.id)
  const groupedResults = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of searchResults || []) {
      const personId = String(r?.person?.id || r?.person_id || r?.id || '')
      const companyId = String(r?.organization?.id || r?.company?.id || r?.organization_id || '')
      const personName = r?.person?.full_name || r?.person?.name || r?.person_name || r?.name || 'Unknown'
      const avatarUrl = r?.person?.photo || r?.person?.avatar_url || r?.person?.photo_url || r?.avatar_url
      const companyName = r?.organization?.name || r?.company?.name || r?.organization_name || '—'
      const companyLogoUrl = r?.organization?.logo || r?.company?.logo
      const location = r?.person?.location?.name || r?.person?.location || r?.location || '—'
      const start = r?.start_date || r?.role?.position_start_date || r?.position_start_date || r?.role_position_start_date
      const end = r?.end_date || r?.role?.position_end_date || r?.position_end_date || r?.role_position_end_date
      const personLinkedInIdentifier = r?.person?.linkedin_info?.public_identifier
      const personLinkedIn = r?.person?.linkedin_info?.public_profile_url || (personLinkedInIdentifier ? `https://www.linkedin.com/in/${personLinkedInIdentifier}/` : undefined)
      const companyLinkedInIdentifier = r?.organization?.linkedin_info?.public_identifier
      const companyLinkedIn = r?.organization?.linkedin_info?.public_profile_url || (companyLinkedInIdentifier ? `https://www.linkedin.com/company/${companyLinkedInIdentifier}/` : undefined)
      const companyWebsite = r?.organization?.website
      const companyDomain = r?.organization?.domain
      const isCurrent = Boolean(r?.is_current)
      const roleTitle = r?.role_title || r?.role?.title || '—'
      const roleDescription = r?.role_description ?? r?.role?.description ?? ''
      const key = `${personId || personName}::${companyId || companyName}`

      if (!map.has(key)) {
        const rawHeadline = r?.person?.headline ?? r?.person_headline
        const personHeadline = typeof rawHeadline === 'string' ? rawHeadline : (Array.isArray(rawHeadline) && rawHeadline.length > 0 ? rawHeadline[0] : '')
        const personDescription = r?.person?.description ?? r?.person_description ?? ''
        const orgDescription = r?.organization?.description ?? r?.organization_description ?? ''
        const orgEmployees = r?.organization?.employee_count ?? r?.organization_employees ?? r?.organization?.employees ?? undefined
        const orgRevenue = r?.organization?.revenue ?? r?.organization_revenue ?? undefined
        const orgFoundedDate = r?.organization?.founded_date ?? r?.organization_founded_date ?? ''
        const orgIndustries = (() => {
          const ind = r?.organization?.industries ?? r?.organization_industries
          if (!ind || !Array.isArray(ind)) return ''
          return ind.map((i: any) => (typeof i === 'string' ? i : i?.name ?? i?.id ?? '')).filter(Boolean).join(', ')
        })()
        map.set(key, {
          key,
          personId,
          personName,
          avatarUrl,
          companyId,
          companyName,
          companyLogoUrl,
          location,
          personLinkedIn,
          companyLinkedIn,
          companyWebsite,
          companyDomain,
          personHeadline: typeof personHeadline === 'string' ? personHeadline : '',
          personDescription: typeof personDescription === 'string' ? personDescription : '',
          organizationDescription: typeof orgDescription === 'string' ? orgDescription : '',
          organizationEmployees: typeof orgEmployees === 'number' ? orgEmployees : undefined,
          organizationRevenue: typeof orgRevenue === 'number' ? orgRevenue : undefined,
          organizationFoundedDate: typeof orgFoundedDate === 'string' ? orgFoundedDate : '',
          organizationIndustries: typeof orgIndustries === 'string' ? orgIndustries : '',
          roles: [] as Array<{ id: string; title: string; start?: string; end?: string; isCurrent?: boolean; description?: string }>
        })
      }
      const group = map.get(key)!
      group.roles.push({ id: String(r?.id ?? `${personId}-${companyId}-${group.roles.length}`), title: roleTitle, start, end, isCurrent, description: roleDescription })
    }

    // Choose primary role (prefer current, else latest start)
    return Array.from(map.values()).map((g) => {
      const roles = [...g.roles]
      roles.sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1
        if (!a.isCurrent && b.isCurrent) return 1
        const da = a.start ? Date.parse(a.start) : 0
        const db = b.start ? Date.parse(b.start) : 0
        return db - da
      })
      return { ...g, roles }
    })
  }, [searchResults])

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }
  return { groupedResults, toggleGroup }
}
