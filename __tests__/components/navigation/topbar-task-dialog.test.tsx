import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { CreateTaskDialog } from '@/app/components/create-task-dialog'
import { createTask } from '@/app/tasks/actions'
import { createClient } from '@/lib/supabase/client'
import { siteMembersService } from '@/app/services/site-members-service'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockSite }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/tasks/actions', () => ({ createTask: jest.fn() }))
jest.mock('@/app/services/site-members-service', () => ({ siteMembersService: { getAssigneeOptions: jest.fn() } }))
jest.mock('@/app/commerce/resolve-relation', () => ({
  resolveRelationId: async (_entity: string, value: { id: string } | null) => ({ id: value?.id ?? null, error: null }),
}))
const settings = { calendars: [{ id: 'cal-a', name: 'Team hours', duration: 45, location: 'Office' }] }
const mockSite = { currentSite: { id: 'site', settings }, isLoading: false, requestScope: { siteId: 'site', actorId: 'actor' } }
const loadMembers = jest.mocked(siteMembersService.getAssigneeOptions)
const leads = jest.fn(), profiles = jest.fn()
const originalObserver = global.ResizeObserver
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
afterAll(() => { global.ResizeObserver = originalObserver })
beforeEach(() => {
  jest.clearAllMocks(); mockSite.requestScope.actorId = 'actor'
  loadMembers.mockReset().mockResolvedValue([{ id: 'member', name: 'Assignee' }])
  profiles.mockResolvedValue({ data: [{ id: 'member', name: 'Assignee',
    settings: { calendar: { event_types: [{ id: 'cal-b', title: 'Meeting', duration: 15 }] } } }] })
  leads.mockResolvedValue({ data: [{ id: 'lead-a', name: 'Contact' }] })
  jest.mocked(createClient).mockImplementation(() => ({ from: (table: string) => ({ select: () =>
    table === 'profiles' ? { in: (field: string, ids: string[]) => ({ abortSignal: (signal: AbortSignal) => profiles(field, ids, signal) }) }
      : { eq: (field: string, siteId: string) => ({ abortSignal: (signal: AbortSignal) => leads(field, siteId, signal) }) },
  }) }))
})
function ui(actor = 'actor') {
  return <AuthContext.Provider value={{ user: { id: actor }, isLoading: false } as AuthContextValue}><CreateTaskDialog /></AuthContext.Provider>
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const fill = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })

it('loads the New Task form only when opened, preserves member, calendar and lead scope, and retries reads without submitting', async () => {
  loadMembers.mockRejectedValueOnce(new Error('unavailable'))
  jest.mocked(createTask).mockResolvedValue({})
  render(ui()); expect(loadMembers).not.toHaveBeenCalled(); expect(leads).not.toHaveBeenCalled()
  click('New Task'); expect(await screen.findByRole('alert')).toHaveTextContent('Could not load team members and calendars')
  expect(screen.getByRole('button', { name: 'Create task' })).toBeDisabled()
  fill('Enter task title', 'New visit'); fill('Enter task description', 'Meet at the office')
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!); expect(createTask).not.toHaveBeenCalled()
  click('Retry loading options')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled())
  expect(loadMembers.mock.calls).toEqual([['site'], ['site']])
  expect(leads.mock.calls).toEqual([['site_id', 'site', expect.any(AbortSignal)]])
  expect(profiles.mock.calls).toEqual([['id', ['member'], expect.any(AbortSignal)]])
  const calendar = screen.getByPlaceholderText('Link to a specific calendar/schedule...')
  fireEvent.change(calendar, { target: { value: 'Team hours' } }); expect(await screen.findByText('Team hours (Team)')).toBeVisible()
  fireEvent.change(calendar, { target: { value: 'Meeting' } }); fireEvent.click(await screen.findByText('Meeting (Assignee)'))
  fill('Select lead', 'Contact'); fireEvent.click(await screen.findByText('Contact'))
  fill('Select user', 'Assignee'); fireEvent.click(await screen.findByText('Assignee'))
  expect(createTask).not.toHaveBeenCalled()
  click('Create task'); await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({
    title: 'New visit', lead_id: 'lead-a', assignee: 'member', site_id: 'site',
    metadata: { _calendar_context: expect.objectContaining({ catalog_item_id: 'cal-b', duration: '15 min' }) },
  })))
})

it('does not start profile enrichment from a retired actor’s pending member list', async () => {
  let resolve!: (members: Array<{ id: string; name: string }>) => void
  loadMembers.mockReturnValueOnce(new Promise(done => { resolve = done }))
  const view = render(ui()); click('New Task'); expect(loadMembers).toHaveBeenCalledTimes(1)
  mockSite.requestScope.actorId = 'new-actor'; view.rerender(ui('new-actor'))
  expect(leads.mock.calls[0][2].aborted).toBe(true); expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => resolve([{ id: 'old-id', name: 'Retired member' }]))
  expect(profiles).not.toHaveBeenCalled(); expect(loadMembers).toHaveBeenCalledTimes(1)
  click('New Task'); await waitFor(() => expect(profiles).toHaveBeenCalledTimes(1))
  expect(profiles.mock.calls[0][1]).toEqual(['member'])
})