import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import useSWR from 'swr'
import { AuthContext, type AuthContextValue, useAuthContext } from '@/app/components/auth/auth-context'
import { ScreenAccessProvider } from '@/app/context/ScreenAccessContext'
import { WorkspaceSiteSWRScope } from '@/app/providers/WorkspaceSiteSWRScope'
import { WorkspaceConversationList } from '@/app/chat/WorkspaceConversationList'
import { notifyScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'

const id = '00000000-0000-4000-8000-000000000001'
const mockSite = { requestScope: { actorId: 'actor', siteId: id }, currentSite: { id } as { id: string } | null,
  isLoading: true, error: null as Error | null, refreshSites: jest.fn(), sites: [] as Array<{ id: string }> }
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
  Object.assign(mockSite, { requestScope: { actorId: 'actor', siteId: id }, currentSite: { id }, error: null, isLoading: true, sites: [] })
})
it('uses silent conversation placeholders while access is pending', async () => {
  mockReadScope.mockReturnValue(new Promise(() => {}))
  const { container } = render(tree()); await act(async () => {})
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
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
  mockSite.sites = [{ id }]
  mockCapability = { siteId: id, capabilities: { role: 'owner', select: true } }
  const view = render(tree()); await act(async () => {})
  expect(mockLegacyMember).toHaveBeenCalledTimes(1); expect(mockConversations).not.toHaveBeenCalled()
  mockCapability = { siteId: id, capabilities: { role: 'collaborator', select: true } }
  mockSite.isLoading = false
  await act(async () => { view.rerender(tree()) }); expect(mockConversations).not.toHaveBeenCalled()
  mockCapability = { siteId: id, capabilities: { role: 'owner', select: true } }
  view.rerender(tree()); await screen.findByText('interactive: private row')
})