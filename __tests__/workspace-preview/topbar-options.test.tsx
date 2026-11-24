import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { TopBar } from '@/app/components/navigation/TopBar'
import { createClient } from '@/lib/supabase/client'
import { handleCreateExperiment, handleCreateLead, handleCreateRequirement } from '@/app/components/navigation/topbar-create-handlers'
import { createCampaign } from '@/app/campaigns/actions/campaigns/create'
import { createContent } from '@/app/content/actions'

// Only replace dynamic module loading, unrelated toolbar actions and I/O. The
// native buttons, permission gate, Radix dialogs, pickers and forms are real.
jest.mock('next/dynamic', () => ({ __esModule: true, default: () => function Loaded(props: object) {
  const { TopBarActions } = jest.requireActual('@/app/components/navigation/TopBarActions')
  return <TopBarActions {...props} />
} }))
jest.mock('@/app/components/navigation/TopBarTitle', () => ({ TopBarTitle: () => null }))
jest.mock('@/app/components/navigation/PosTopBarSync', () => ({ PosTopBarSync: () => null }))
jest.mock('@/app/components/navigation/PosTopBarActions', () => ({ PosTopBarActions: () => null }))
jest.mock('@/app/components/navigation/RobotPrimaryActions', () => ({ RobotPrimaryActions: () => null }))
jest.mock('@/app/components/create-task-dialog', () => ({ CreateTaskDialog: () => null }))
jest.mock('@/app/components/navigation/TopBarCommerceActions', () => ({ TopBarCommerceActions: () => null }))
jest.mock('@/app/components/navigation/TopBarFinanceActions', () => ({ TopBarFinanceActions: () => null }))
jest.mock('@/app/workspace-preview/WorkspaceStartupBoundary', () => ({ useWorkspaceStartup: () => mockStartup }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockSite }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => mockAccess }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => mockPermissions }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => mockLabels[key] ?? '' }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/components/navigation/topbar-create-handlers', () => ({
  handleCreateExperiment: jest.fn(), handleCreateLead: jest.fn(), handleCreateRequirement: jest.fn(),
}))
jest.mock('@/app/campaigns/actions/campaigns/create', () => ({ createCampaign: jest.fn() }))
jest.mock('@/app/content/actions', () => ({ createContent: jest.fn() }))
jest.mock('@/app/commerce/resolve-relation', () => ({
  resolveRelationId: async (_entity: string, value: { id: string } | null) => ({ id: value?.id ?? null, error: null }),
}))
jest.mock('@/app/utils/safe-reload', () => ({ safeReload: jest.fn() }))

const mockLabels: Record<string, string> = {
  'layout.topbar.addLead': 'Add Lead', 'layout.topbar.newContent': 'New Content', 'layout.topbar.newCampaign': 'New Campaign',
  'layout.topbar.newRequirement': 'New Requirement', 'layout.topbar.newExperiment': 'New Experiment',
}
const mockSite = { currentSite: { id: 'site-a', name: 'Site A' }, requestScope: { siteId: 'site-a', actorId: 'actor-a' }, isLoading: false }
const mockAccess = { isReady: true, canAccessNavKey: jest.fn() }
const mockPermissions = { siteId: 'site-a', capabilities: { role: 'owner' }, can: jest.fn() }
let mockStartup = false
let actor: string | null = 'actor-a', authLoading = false, anonymous = false
const segment = { id: 's', name: 'Target audience', description: 'Description' }
const campaign = { id: 'c', title: 'Launch campaign', description: '' }
type Result = { data: unknown; error?: { message: string } }
const read = jest.fn<Promise<Result>, [table: string, site: string, signal: AbortSignal]>()
const originalResizeObserver = global.ResizeObserver

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
afterAll(() => { global.ResizeObserver = originalResizeObserver })
beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(mockSite, { currentSite: { id: 'site-a', name: 'Site A' }, requestScope: { siteId: 'site-a', actorId: 'actor-a' }, isLoading: false })
  mockAccess.isReady = true; mockAccess.canAccessNavKey.mockReturnValue(true)
  mockPermissions.siteId = 'site-a'; mockPermissions.capabilities.role = 'owner'; mockPermissions.can.mockReturnValue(true)
  mockStartup = false; actor = 'actor-a'; anonymous = false; authLoading = false
  localStorage.clear()
  read.mockReset().mockImplementation(async table => ({ data: table === 'segments' ? [segment] : [campaign] }))
  jest.mocked(createClient).mockImplementation(() => ({ from: (table: string) => ({ select: () => ({
    eq: (field: string, site: string) => { expect(field).toBe('site_id'); return { order: () => ({
      abortSignal: (signal: AbortSignal) => read(table, site, signal),
    }) } },
  }) }) }))
})

function ui(path: string, segments?: typeof segment[]) {
  jest.mocked(usePathname).mockReturnValue(path)
  return <AuthContext.Provider value={{ isLoading: authLoading, user: actor ? { id: actor, is_anonymous: anonymous } : null } as AuthContextValue}>
    <TopBar title="Workspace" isCollapsed onCollapse={() => {}} segments={segments} />
  </AuthContext.Provider>
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const calls = () => read.mock.calls.map(([table, site]) => [table, site])
const settle = () => act(async () => {})
const fill = (placeholder: string, value: string) => fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
const submitForm = () => fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
function pending() {
  let resolve!: (value: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}

it.each([
  ['/leads', 'Add Lead'], ['/content', 'New Content'], ['/campaigns', 'New Campaign'],
  ['/requirements', 'New Requirement'], ['/experiments', 'New Experiment'],
])('only requests the %s form directories when its trigger actually opens the dialog', async (path, label) => {
  const view = render(ui(path))
  const trigger = screen.getByRole('button', { name: label })
  fireEvent.focus(trigger); fireEvent.pointerEnter(trigger); await settle()
  expect(read).not.toHaveBeenCalled()
  // A native button's keyboard-generated click has detail 0 (jsdom doesn't synthesize it).
  fireEvent.click(trigger, { detail: 0 })
  expect(screen.getByRole('dialog')).toBeVisible()
  await waitFor(() => expect(screen.queryByText('Loading options…')).not.toBeInTheDocument())
  const expected = path === '/campaigns' ? [['segments', 'site-a']] : [['segments', 'site-a'], ['campaigns', 'site-a']]
  expect(calls()).toEqual(expected)
  if (path === '/leads' || path === '/content') {
    const picker = screen.getByPlaceholderText(path === '/leads' ? 'Select campaign' : 'Select a campaign (optional)')
    fireEvent.change(picker, { target: { value: 'Launch' } })
    expect(await screen.findByText(campaign.title)).toBeVisible()
    fireEvent.keyDown(picker, { key: 'Enter' }); expect(picker).toHaveValue(campaign.title)
  } else expect(screen.getByRole('switch', { name: segment.name })).toBeVisible()
  mockSite.currentSite = { ...mockSite.currentSite, name: 'Same site, new name' }
  view.rerender(ui(path)); await settle(); expect(calls()).toEqual(expected)
})

it.each(['siteLoading', 'preview', 'authLoading', 'noActor', 'anonymous', 'foreignActor', 'foreignSite', 'screenPending', 'screenBlocked', 'readOnly', 'foreignPermission'])('does not admit a click or Campaigns empty-state event during %s', async reason => {
  if (reason === 'siteLoading') mockSite.isLoading = true
  if (reason === 'preview') mockStartup = true
  if (reason === 'authLoading') authLoading = true
  if (reason === 'noActor') actor = null
  if (reason === 'anonymous') anonymous = true
  if (reason === 'foreignActor') actor = 'other'
  if (reason === 'foreignSite') mockSite.requestScope.siteId = 'other'
  if (reason === 'screenPending') mockAccess.isReady = false
  if (reason === 'screenBlocked') mockAccess.canAccessNavKey.mockReturnValue(false)
  if (reason === 'readOnly') mockPermissions.can.mockImplementation(command => command === 'select')
  if (reason === 'foreignPermission') mockPermissions.siteId = 'other'
  render(ui('/campaigns'))
  screen.queryByRole('button', { name: 'New Campaign' })?.click()
  fireEvent(window, new Event('campaigns:create')); await settle()
  expect(screen.queryByRole('dialog')).toBeNull(); expect(read).not.toHaveBeenCalled()
})

it('uses supplied segments (including a confirmed empty directory) and accepts the allowed empty-state trigger', async () => {
  const view = render(ui('/campaigns', [segment]))
  fireEvent(window, new Event('campaigns:create'))
  expect(screen.getByRole('switch', { name: segment.name })).toBeVisible(); expect(read).not.toHaveBeenCalled()
  view.rerender(ui('/requirements', [])); click('New Requirement')
  expect(await screen.findByText('No segments available')).toBeVisible()
  expect(calls()).toEqual([['campaigns', 'site-a']]); expect(screen.getByRole('button', { name: 'Create requirement' })).toBeDisabled()
})

it('only uses the demo client when its selected demo site matches', async () => {
  const id = 'demo-workspace'; localStorage.setItem('currentSiteId', id); actor = null
  const view = render(ui('/leads')); click('Add Lead'); expect(read).not.toHaveBeenCalled()
  mockSite.currentSite.id = mockPermissions.siteId = id
  view.rerender(ui('/leads')); expect(read).not.toHaveBeenCalled()
  click('Add Lead'); await screen.findByPlaceholderText('Select segment')
  expect(calls()).toEqual([['segments', id], ['campaigns', id]])
})

it.each(['route', 'site', 'actor', 'permission', 'preview', 'close'])('discards pending reads and requires a new open after a %s change', async reason => {
  const stale = pending()
  read.mockImplementationOnce(() => stale.promise)
  const view = render(ui('/requirements')); click('New Requirement')
  const oldSignal = read.mock.calls[0][2]
  fill('Enter requirement title', 'Private draft')
  let path = '/requirements'
  if (reason === 'route') path = '/content'
  if (reason === 'site') mockSite.currentSite.id = mockSite.requestScope.siteId = mockPermissions.siteId = 'site-b'
  if (reason === 'actor') actor = mockSite.requestScope.actorId = 'actor-b'
  if (reason === 'permission') mockPermissions.can.mockReturnValue(false)
  if (reason === 'preview') mockStartup = true
  if (reason === 'close') click('Cancel')
  view.rerender(ui(path)); expect(oldSignal.aborted).toBe(true)
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => stale.resolve({ data: [{ ...segment, name: 'Retired audience' }] }))
  mockPermissions.can.mockReturnValue(true); mockStartup = false
  view.rerender(ui('/requirements')); await settle(); expect(read).toHaveBeenCalledTimes(2)
  click('New Requirement'); expect(await screen.findByText(segment.name)).toBeVisible()
  expect(screen.queryByText('Retired audience')).toBeNull(); expect(screen.queryByDisplayValue('Private draft')).toBeNull()
  expect(calls().slice(-2)).toEqual([['segments', mockSite.currentSite.id], ['campaigns', mockSite.currentSite.id]])
})

it('shows a failed picker as a failure, blocks keyboard submit, and retries only the failed read without losing the draft', async () => {
  read.mockImplementationOnce(async () => ({ data: null, error: { message: 'unavailable' } }))
  jest.mocked(handleCreateLead).mockResolvedValue({})
  render(ui('/leads')); click('Add Lead')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load segments')
  fill('Enter lead name', 'A lead'); fill('example@company.com', 'lead@example.test')
  expect(screen.getByRole('button', { name: 'Create lead' })).toBeDisabled()
  fireEvent.keyDown(screen.getByPlaceholderText('Enter lead name'), { key: 'Enter', ctrlKey: true })
  await settle(); expect(handleCreateLead).not.toHaveBeenCalled()
  click('Retry loading options')
  const picker = await screen.findByPlaceholderText('Select segment')
  fireEvent.change(picker, { target: { value: 'Target' } }); fireEvent.keyDown(picker, { key: 'Enter' })
  expect(calls()).toEqual([['segments', 'site-a'], ['campaigns', 'site-a'], ['segments', 'site-a']])
  expect(handleCreateLead).not.toHaveBeenCalled()
  click('Create lead'); await waitFor(() => expect(handleCreateLead).toHaveBeenCalledWith(expect.objectContaining({
    name: 'A lead', email: 'lead@example.test', site_id: 'site-a', segment_id: segment.id,
  })))
})

it.each(['requirements', 'experiments'])('still requires a selected segment in %s after the picker resolves', async route => {
  const isRequirement = route === 'requirements'
  const submit = isRequirement ? handleCreateRequirement : handleCreateExperiment
  jest.mocked(submit).mockResolvedValue({ data: {} })
  render(ui(`/${route}`)); click(isRequirement ? 'New Requirement' : 'New Experiment')
  const toggle = await screen.findByRole('switch', { name: segment.name })
  fill(isRequirement ? 'Enter requirement title' : 'Enter experiment name', 'New proposal')
  fill(isRequirement ? 'Describe your requirement' : 'Describe your experiment', 'Proposal description')
  if (!isRequirement) fill('What is your hypothesis?', 'An improvement')
  const button = screen.getByRole('button', { name: isRequirement ? 'Create requirement' : 'Create Experiment' })
  expect(button).toBeDisabled(); submitForm(); await settle(); expect(submit).not.toHaveBeenCalled()
  fireEvent.click(toggle); fireEvent.click(button)
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ segments: [segment.id], site_id: 'site-a', user_id: actor })))
})

it('retires an already selected relation and draft on a role change at the same site', async () => {
  const view = render(ui('/experiments')); click('New Experiment')
  fireEvent.click(await screen.findByRole('switch', { name: segment.name }))
  fill('Enter experiment name', 'Prior draft'); mockPermissions.capabilities.role = 'collaborator'
  view.rerender(ui('/experiments')); expect(screen.queryByRole('dialog')).toBeNull()
  expect(read).toHaveBeenCalledTimes(2)
  click('New Experiment'); expect(await screen.findByRole('switch', { name: segment.name })).not.toBeChecked()
  expect(screen.getByPlaceholderText('Enter experiment name')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Create Experiment' })).toBeDisabled()
})

it('blocks resubmitting a draft whose selected option disappeared on reopen; it never silently clears the relation', async () => {
  jest.mocked(createContent).mockResolvedValue({ error: 'Rejected' })
  render(ui('/content')); click('New Content')
  fill('Enter content title', 'Draft with attribution')
  const picker = await screen.findByPlaceholderText('Select a campaign (optional)')
  fireEvent.change(picker, { target: { value: 'Launch' } }); fireEvent.keyDown(picker, { key: 'Enter' })
  fireEvent.click(screen.getByRole('dialog').querySelector('[data-slot="dialog-close"]')!)
  read.mockResolvedValue({ data: [] }); click('New Content')
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer available')
  expect(await screen.findByPlaceholderText('Select a campaign (optional)')).toHaveValue(campaign.title)
  expect(screen.getByRole('button', { name: 'Create Content' })).toBeDisabled()
  submitForm(); expect(createContent).not.toHaveBeenCalled()
  click('Clear selection'); expect(screen.queryByRole('alert')).toBeNull()
  click('Create Content'); await waitFor(() => expect(createContent).toHaveBeenCalledWith(expect.objectContaining({
    title: 'Draft with attribution', siteId: 'site-a', campaign_id: null,
  })))
})

it('keeps Campaign validation and the dirty-close guard on the real form', async () => {
  render(ui('/campaigns')); click('New Campaign')
  await screen.findByRole('switch', { name: segment.name })
  submitForm(); expect(await screen.findByText('Title must be at least 3 characters')).toBeVisible()
  expect(createCampaign).not.toHaveBeenCalled()
  fill('Campaign title', 'Keep my draft'); await settle(); click('Cancel')
  expect(await screen.findByText('Discard changes?')).toBeVisible()
  expect(read).toHaveBeenCalledTimes(1)
})

it('does not silently submit Content without a title or with unresolved campaign options', async () => {
  const loading = pending(); read.mockImplementationOnce(async () => ({ data: [] })).mockImplementationOnce(() => loading.promise)
  render(ui('/content')); click('New Content')
  const button = within(screen.getByRole('dialog')).getByRole('button', { name: 'Create Content' })
  fill('Enter content title', 'Article'); expect(button).toBeDisabled(); submitForm(); expect(createContent).not.toHaveBeenCalled()
  await act(async () => loading.resolve({ data: [] })); expect(button).toBeEnabled()
  fill('Enter content title', '   '); expect(button).toBeDisabled(); submitForm(); expect(createContent).not.toHaveBeenCalled()
})