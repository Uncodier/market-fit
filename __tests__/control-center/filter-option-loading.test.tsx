import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useControlCenterPage } from '@/app/control-center/hooks/useControlCenterPage'
import { useSite } from '@/app/context/SiteContext'
import { siteMembersService } from '@/app/services/site-members-service'
import { createClient } from '@/utils/supabase/client'

jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/hooks/use-command-k', () => ({ useCommandK: jest.fn() }))
jest.mock('@/lib/navigation/navigation-helpers', () => ({ navigateToTask: jest.fn() }))
jest.mock('@/app/services/user-service', () => ({ getUserData: jest.fn() }))
jest.mock('@/app/services/site-members-service', () => ({ siteMembersService: { getAssigneeOptions: jest.fn() } }))
jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))

type Option = { id: string; name: string }
const leadFor = (site: string): Option => ({ id: `lead-${site}`, name: `Lead at ${site}` })
const memberFor = (site: string): Option => ({ id: `member-${site}`, name: `Member at ${site}` })
const memberOptions = jest.mocked(siteMembersService.getAssigneeOptions)

function setSiteFixture(id: string | null) {
  jest.mocked(useSite).mockReturnValue({ currentSite: id ? { id } : null } as ReturnType<typeof useSite>)
}

function mountPage(readLeads: (site: string) => Promise<Option[]> = async id => [leadFor(id)]) {
  const reads = { leads: [] as string[], tasks: [] as string[], categories: [] as string[] }
  const from = (table: keyof typeof reads) => {
    let siteId = ''
    let status = ''
    const query = {
      select: () => query,
      eq(column: string, value: string) {
        if (column === 'site_id') siteId = value
        if (column === 'status') status = value
        return query
      },
      order: () => query,
      limit: () => query,
      then(resolve: (response: { data: unknown[]; count?: number; error: null }) => unknown) {
        reads[table].push(siteId)
        if (table === 'leads') return readLeads(siteId).then(data => resolve({ data, error: null }))
        const data = table === 'tasks' && status === 'pending' ? [
          { id: 'match', status, lead_id: leadFor(siteId).id, assignee: memberFor(siteId).id },
          { id: 'other', status, lead_id: null, assignee: null },
        ] : []
        return resolve({ data, count: data.length, error: null })
      },
    }
    return query
  }
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  const config = { provider: () => new Map(), keepPreviousData: true, shouldRetryOnError: false }
  function Wrapper({ children }: { children: ReactNode }) {
    return <SWRConfig value={config}>{children}</SWRConfig>
  }
  return { ...renderHook(() => useControlCenterPage(), { wrapper: Wrapper }), reads }
}

function deferredOptions() {
  let finish!: (rows: Option[]) => void
  const promise = new Promise<Option[]>(resolve => { finish = resolve })
  return { promise, finish }
}

beforeEach(() => {
  jest.clearAllMocks()
  setSiteFixture('a')
  memberOptions.mockImplementation(async id => [memberFor(id)])
})

it('loads tasks and categories on mount, but waits for the filter dialog before either option read', async () => {
  const { result, reads } = mountPage()
  await waitFor(() => expect(result.current.filteredTasks).toHaveLength(2))
  expect(reads.tasks).toHaveLength(5)
  expect(reads.categories).toEqual(['a'])
  expect(reads.leads).toEqual([])
  expect(memberOptions).not.toHaveBeenCalled()

  act(() => result.current.setIsFilterModalOpen(true))
  await waitFor(() => {
    expect(result.current.leads).toEqual([leadFor('a')])
    expect(result.current.users).toEqual([memberFor('a')])
  })
  expect(reads.leads).toEqual(['a'])
  expect(memberOptions.mock.calls).toEqual([['a']])

  const selected = { stage: [], status: [], leadId: [leadFor('a').id], assigneeId: [memberFor('a').id] }
  act(() => {
    result.current.setFilters(selected)
    result.current.setIsFilterModalOpen(false)
  })
  expect(result.current.filters).toEqual(selected)
  expect(result.current.filteredTasks.map(task => task.id)).toEqual(['match'])
  expect(result.current.getTotalActiveFilters()).toBe(2)
  act(() => result.current.setIsFilterModalOpen(true))
  expect(result.current.leads.find(lead => lead.id === selected.leadId[0])?.name).toBe(leadFor('a').name)
  expect(result.current.users.find(user => user.id === selected.assigneeId[0])?.name).toBe(memberFor('a').name)
  expect(result.current.filters).toEqual(selected)
})

it('does not start option reads on a closed site switch or without a site', async () => {
  const { result, rerender, reads } = mountPage()
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  setSiteFixture('b')
  rerender()
  await waitFor(() => expect(reads.tasks.filter(id => id === 'b')).toHaveLength(5))
  setSiteFixture(null)
  rerender()
  act(() => result.current.setIsFilterModalOpen(true))
  expect(reads.leads).toEqual([])
  expect(memberOptions).not.toHaveBeenCalled()
  setSiteFixture('c')
  rerender()
  await waitFor(() => expect(result.current.leads).toEqual([leadFor('c')]))
  expect(reads.leads).toEqual(['c'])
  expect(memberOptions.mock.calls).toEqual([['c']])
})

it('never renders prior-site options or a late response into an open dialog on another site', async () => {
  const slowLeads = deferredOptions()
  const slowMembers = deferredOptions()
  memberOptions.mockImplementation(async site => site === 'b' ? slowMembers.promise : [memberFor(site)])
  const { result, rerender, reads } = mountPage(async site => site === 'b' ? slowLeads.promise : [leadFor(site)])
  act(() => result.current.setIsFilterModalOpen(true))
  await waitFor(() => {
    expect(result.current.leads).toEqual([leadFor('a')])
    expect(result.current.users).toEqual([memberFor('a')])
  })
  setSiteFixture('b')
  rerender()
  expect(result.current.leads).toEqual([])
  expect(result.current.users).toEqual([])
  await waitFor(() => expect(reads.leads).toContain('b'))
  setSiteFixture('c')
  rerender()
  await waitFor(() => {
    expect(result.current.leads).toEqual([leadFor('c')])
    expect(result.current.users).toEqual([memberFor('c')])
  })
  await act(async () => {
    slowLeads.finish([leadFor('b')])
    slowMembers.finish([memberFor('b')])
  })
  expect(result.current.leads).toEqual([leadFor('c')])
  expect(result.current.users).toEqual([memberFor('c')])
})