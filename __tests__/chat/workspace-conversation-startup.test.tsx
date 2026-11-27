import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import useSWR from 'swr'
import { AuthContext, type AuthContextValue, useAuthContext } from '@/app/components/auth/auth-context'
import { ScreenAccessProvider } from '@/app/context/ScreenAccessContext'
import { WorkspaceSiteSWRScope } from '@/app/providers/WorkspaceSiteSWRScope'
import { WorkspaceConversationList } from '@/app/chat/WorkspaceConversationList'
import { notifyScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'

const id = '00000000-0000-4000-8000-000000000001'
const mockSite = { requestScope: { actorId: 'actor', siteId: id }, currentSite: { id } as { id: string } | null,
  isLoading: true, sitesLoaded: false, error: null as Error | null, refreshSites: jest.fn(), sites: [] as Array<{ id: string }> }
const allowed = { data: { actor_id: 'actor', site_id: id, role: 'collaborator', blocked_screens: [], location_restricted: false }, error: null }
const mockReadScope = jest.fn()
const mockLegacyMember = jest.fn()
let mockCapability: { siteId: string; capabilities: { role: string; select: boolean } } | null = null
const mockConversations = jest.fn()
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockSite, useOptionalSite: () => mockSite }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => mockCapability }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  rpc: () => ({ retry: () => ({ abortSignal: mockReadScope }) }),
  from: () => ({ select() { return this }, eq() { return this }, maybeSingle: () => ({ retry: () => ({ abortSignal: mockLegacyMember }) }) }),
}) }))
jest.mock('@/app/components/chat/chat-list', () => ({ ChatList: StubList }))
// Real scoped cache + middleware. Only the actual PostgREST inbox transport and
// row renderer are substituted here; the list hook/service have separate tests.
function StubList({ siteId, previewOnly }: { siteId: string; previewOnly: boolean }) {
  const { user } = useAuthContext()
  const { data } = useSWR(['conversations', siteId, 'all', '', user!.id], mockConversations)
  return <span>{previewOnly ? 'preview' : 'interactive'}: {data}</span>
}
const normalFetcher = jest.fn(async () => 'regular')
function OtherResource() { useSWR(['orders', id], normalFetcher); return null }
function tree(actor = 'actor') {
  return <AuthContext.Provider value={{ user: { id: actor }, isLoading: false } as AuthContextValue}>
    <WorkspaceSiteSWRScope><ScreenAccessProvider><WorkspaceConversationList onSelectConversation={jest.fn()} />
      <OtherResource /></ScreenAccessProvider></WorkspaceSiteSWRScope></AuthContext.Provider>
}
beforeEach(() => {
  jest.clearAllMocks(); mockReadScope.mockReset().mockResolvedValue(allowed); mockConversations.mockReset().mockResolvedValue('private row')
  mockCapability = null
  mockLegacyMember.mockReset().mockResolvedValue({ data: null, error: null })
  Object.assign(mockSite, { requestScope: { actorId: 'actor', siteId: id }, currentSite: { id }, error: null, sitesLoaded: false, isLoading: true, sites: [] })
})
it('uses silent conversation placeholders while access is pending', async () => {
  // A selector error cannot decide the independent inbox access check.
  mockSite.error = new Error('Selector unavailable'); mockSite.isLoading = false
  mockReadScope.mockReturnValue(new Promise(() => {}))
  const { container } = render(tree()); await act(async () => {})
  const skeleton = screen.getByRole('status', { name: 'chat.list.loading' })
  expect(skeleton).toHaveAttribute('aria-busy', 'true')
  expect(skeleton.querySelector('[class~="h-[71px]"]')).toBeInTheDocument()
  expect(skeleton.querySelector('[class~="h-[56px]"]')).toBeInTheDocument()
  expect(container.textContent).toBe(''); expect(container.querySelector('.animate-pulse')).not.toBeNull()
  expect(mockConversations).not.toHaveBeenCalled()
})
it('shows verified RLS rows while settings wait, without starting other data or fetching the list again on hydration', async () => {
  const view = render(tree())
  await screen.findByText('preview: private row')
  expect(mockReadScope).toHaveBeenCalledTimes(1)
  expect(normalFetcher).not.toHaveBeenCalled()
  mockSite.currentSite = null; mockSite.isLoading = false; mockSite.error = new Error('Settings unavailable')
  await act(async () => { view.rerender(tree()) })
  expect(screen.getByText('preview: private row')).toBeVisible()
  mockSite.currentSite = { id }; mockSite.error = null
  view.rerender(tree())
  expect(screen.getByText('interactive: private row')).toBeVisible()
  expect(mockConversations).toHaveBeenCalledTimes(1)
})
it.each([{ ...allowed.data, actor_id: 'other' }, { ...allowed.data, site_id: 'old' },
  { ...allowed.data, blocked_screens: ['chat'] }, { ...allowed.data, location_restricted: true }, null])(
  'does not read conversations when server scope does not admit them: %j', async data => {
    mockReadScope.mockResolvedValue({ data, error: null })
    render(tree()); await act(async () => {})
    expect(mockConversations).not.toHaveBeenCalled()
    expect(screen.queryByText(/private row/)).not.toBeInTheDocument()
  })
it('drops rows on confirmed invalidation and does not borrow the last cached row if the actor or scope changes', async () => {
  const view = render(tree()); await screen.findByText('preview: private row')
  mockReadScope.mockResolvedValueOnce({ data: null, error: null })
  act(() => notifyScreenScopeChanged(id)); await screen.findByText('chat.workspace.denied')
  view.rerender(tree('other')); expect(screen.queryByText(/private row/)).toBeNull()
  mockConversations.mockImplementationOnce(() => new Promise(() => {}))
  view.rerender(tree()); await waitFor(() => expect(mockConversations).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(/private row/)).toBeNull()
})
it('shows a retry after a failed scope read; retry does not reload workspace settings', async () => {
  mockReadScope.mockResolvedValueOnce({ data: null, error: { code: '57014' }, status: 500 })
  render(tree()); fireEvent.click(await screen.findByRole('button', { name: 'common.retry' }))
  await screen.findByText('preview: private row')
  expect(mockSite.refreshSites).not.toHaveBeenCalled(); expect(mockReadScope).toHaveBeenCalledTimes(2)
})
it('rejects even a successful late proof after account replacement', async () => {
  let resolve!: (value: typeof allowed) => void
  mockReadScope.mockReturnValueOnce(new Promise(r => { resolve = r }))
  const view = render(tree()); view.rerender(tree('other'))
  await act(async () => resolve(allowed)); expect(mockConversations).not.toHaveBeenCalled()
})

it('without the RPC a selector hit cannot start an early read, or admit a former member after hydration', async () => {
  mockReadScope.mockResolvedValue({ data: null, error: { code: 'PGRST202' }, status: 404 })
  mockCapability = { siteId: id, capabilities: { role: 'owner', select: true } }
  const view = render(tree()); await act(async () => {})
  expect(mockLegacyMember).toHaveBeenCalledTimes(1); expect(mockConversations).not.toHaveBeenCalled()
  mockSite.isLoading = false; view.rerender(tree())
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(mockConversations).not.toHaveBeenCalled()
  mockSite.sites = [{ id }]; mockSite.sitesLoaded = true
  mockCapability = { siteId: id, capabilities: { role: 'collaborator', select: true } }
  mockSite.isLoading = false
  await act(async () => { view.rerender(tree()) }); expect(mockConversations).not.toHaveBeenCalled()
  expect(screen.getByText('chat.workspace.unavailable')).toBeVisible()
  mockCapability = { siteId: id, capabilities: { role: 'owner', select: true } }
  view.rerender(tree()); await screen.findByText('interactive: private row')
})

function visitChat(open: boolean) {
  return <AuthContext.Provider value={{ user: { id: 'actor' }, isLoading: false } as AuthContextValue}>
    <WorkspaceSiteSWRScope><ScreenAccessProvider>
      {open && <WorkspaceConversationList onSelectConversation={jest.fn()} />}
    </ScreenAccessProvider></WorkspaceSiteSWRScope>
  </AuthContext.Provider>
}

function legacyInbox() {
  mockReadScope.mockResolvedValue({ data: null, error: { code: 'PGRST202' }, status: 404 })
  mockCapability = { siteId: id, capabilities: { role: 'owner', select: true } }
  Object.assign(mockSite, { sites: [{ id }], sitesLoaded: true, isLoading: false })
}

it('keeps an admitted legacy inbox read-only across a selector failure and route revisit; resumes once', async () => {
  legacyInbox()
  const view = render(visitChat(true)); await screen.findByText('interactive: private row')
  mockSite.error = new Error('Temporary list failure')
  view.rerender(visitChat(true)); expect(screen.getByText('preview: private row')).toBeVisible()
  expect(screen.queryByText('chat.workspace.unavailable')).toBeNull()
  view.rerender(visitChat(false)); view.rerender(visitChat(true))
  expect(screen.getByText('preview: private row')).toBeVisible()
  let finishRetry!: () => void
  mockSite.refreshSites.mockReturnValueOnce(new Promise<void>(done => { finishRetry = done }))
  fireEvent.click(screen.getByText('common.retry'))
  expect(screen.getByText('common.retry')).toBeDisabled()
  expect(screen.getByText('preview: private row').closest('fieldset')).toBeDisabled()
  expect(mockSite.refreshSites).toHaveBeenCalledWith({ recoverMissingList: true })
  expect(mockConversations).toHaveBeenCalledTimes(1)
  mockConversations.mockResolvedValueOnce('updated row'); mockSite.error = null
  await act(async () => { finishRetry(); view.rerender(visitChat(true)) }); await screen.findByText('interactive: updated row')
  expect(mockConversations).toHaveBeenCalledTimes(2)
})

it('does not start a cold legacy inbox on selector failure, or reuse a warm one after invalidation', async () => {
  legacyInbox(); mockSite.error = new Error('Selector unavailable')
  const view = render(visitChat(true)); await screen.findByText('chat.workspace.unavailable')
  expect(mockConversations).not.toHaveBeenCalled()
  mockSite.error = null; view.rerender(visitChat(true)); await screen.findByText('interactive: private row')
  mockSite.error = new Error('Unavailable again'); view.rerender(visitChat(true))
  expect(screen.getByText('preview: private row')).toBeVisible()
  await act(async () => notifyScreenScopeChanged(id))
  expect(screen.queryByText(/private row/)).toBeNull(); expect(mockConversations).toHaveBeenCalledTimes(1)
})

it('presents the admitted inbox immediately on a route revisit while refreshing page one', async () => {
  const view = render(visitChat(true))
  await screen.findByText('preview: private row')
  view.rerender(visitChat(false))
  let finish!: (row: string) => void
  mockConversations.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  view.rerender(visitChat(true))
  expect(screen.getByText('preview: private row')).toBeVisible()
  await waitFor(() => expect(mockConversations).toHaveBeenCalledTimes(2))
  await act(async () => finish('updated row'))
  expect(screen.getByText('preview: updated row')).toBeVisible()
  expect(mockReadScope).toHaveBeenCalledTimes(1)
})

it('drops the off-route inbox on explicit invalidation even if the new proof grants identical access', async () => {
  const view = render(visitChat(true))
  await screen.findByText('preview: private row')
  view.rerender(visitChat(false))
  await act(async () => notifyScreenScopeChanged(id))
  expect(mockReadScope).toHaveBeenCalledTimes(2)
  mockConversations.mockReturnValueOnce(new Promise(() => {}))
  view.rerender(visitChat(true))
  await waitFor(() => expect(mockConversations).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(/private row/)).toBeNull()
})

it('does not reuse old rows after switching sites and back while the inbox is unmounted', async () => {
  const view = render(visitChat(true))
  await screen.findByText('preview: private row')
  view.rerender(visitChat(false))
  const other = '00000000-0000-4000-8000-000000000002'
  mockSite.requestScope = { actorId: 'actor', siteId: other }; mockSite.currentSite = { id: other }
  mockReadScope.mockResolvedValueOnce({ ...allowed, data: { ...allowed.data, site_id: other } })
  await act(async () => view.rerender(visitChat(false)))
  mockSite.requestScope = { actorId: 'actor', siteId: id }; mockSite.currentSite = { id }
  await act(async () => view.rerender(visitChat(false)))
  mockConversations.mockReturnValueOnce(new Promise(() => {}))
  view.rerender(visitChat(true))
  await waitFor(() => expect(mockConversations).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(/private row/)).toBeNull()
})
