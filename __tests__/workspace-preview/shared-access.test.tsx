import { act, fireEvent, render, screen } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { WorkspaceAccessSnapshot } from '@/app/context/WorkspaceAccessSnapshot'
import { PermissionProvider, usePermissions } from '@/app/context/PermissionContext'
import { ScreenAccessProvider, useScreenAccess } from '@/app/context/ScreenAccessContext'
import { getPermissionStore } from '@/lib/permissions/capabilities'
import { notifyScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'

const siteId = 'a1000000-0000-4000-8000-000000000001'
const mockSite = { currentSite: { id: siteId }, requestScope: { actorId: 'a', siteId } }
const mockRpc = jest.fn(), mockProof = jest.fn(), mockMember = jest.fn()
jest.mock('@/app/context/SiteContext', () => ({ useOptionalSite: () => mockSite }))
jest.mock('@/app/hooks/use-location-permission-revision', () => ({ useLocationPermissionRevision: () => {} }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc: mockRpc, from: () => ({
  select() { return this }, eq() { return this }, maybeSingle: () => ({ retry: () => ({ abortSignal: mockMember }) }),
}) }) }))
function Sink() {
  const permissions = usePermissions(), access = useScreenAccess()
  return <><div data-testid="role">{permissions.capabilities?.role ?? 'none'}</div>
    <div data-testid="write">{String(permissions.can('update'))}</div>
    <div data-testid="admission">{access.verifiedWorkspaceLists ? 'verified' : access.screenScopeStatus}</div>
    <button onClick={() => access.retryScreenScope()}>Recheck</button></>
}
function tree(actor = 'a') {
  return <AuthContext.Provider value={{ user: { id: actor }, isLoading: false } as AuthContextValue}>
    <WorkspaceAccessSnapshot><PermissionProvider><ScreenAccessProvider><Sink /></ScreenAccessProvider></PermissionProvider></WorkspaceAccessSnapshot>
  </AuthContext.Provider>
}
const proof = (role: string) => ({ data: { site_id: siteId, actor_id: 'a', role, blocked_screens: [], location_restricted: false }, error: null })
beforeEach(() => {
  mockRpc.mockReset().mockImplementation((name: string) => name === 'read_workspace_screen_scope'
    ? { retry: () => ({ abortSignal: mockProof }) } : Promise.resolve({ data: { role: 'marketing' }, error: null }))
  mockProof.mockReset().mockResolvedValue(proof('marketing'))
  mockMember.mockReset().mockResolvedValue({ data: { role: 'marketing', blocked_screens: ['leads'] }, error: null })
})
it('uses one verified read for both consumers and retires permissions on invalidation, denial and actor change', async () => {
  mockProof.mockResolvedValueOnce(proof('admin'))
  const ui = render(tree()); await screen.findByText('admin'); expect(getPermissionStore().capabilities?.update).toBe(true)
  ui.rerender(tree()); expect(mockRpc.mock.calls.map(([name]) => name)).toEqual(['read_workspace_screen_scope'])
  mockProof.mockResolvedValueOnce({ data: null, error: null }); act(() => notifyScreenScopeChanged(siteId))
  await screen.findByText('denied'); expect(screen.getByTestId('write')).toHaveTextContent('false')
  expect(getPermissionStore().capabilities?.role).toBe(null)
  fireEvent.click(screen.getByText('Recheck')); await screen.findByText('marketing')
  ui.rerender(tree('other')); expect(screen.getByTestId('role')).toHaveTextContent('none')
  expect(mockRpc).toHaveBeenCalledTimes(3)
})
it('uses capability fallback only on a missing RPC, not on transient or malformed scope', async () => {
  mockProof.mockResolvedValueOnce({ data: null, error: { code: '57014' }, status: 500 })
  render(tree()); await screen.findByText('unavailable')
  expect(screen.getByTestId('write')).toHaveTextContent('false'); expect(mockRpc).toHaveBeenCalledTimes(1)
  mockProof.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' }, status: 404 }); fireEvent.click(screen.getByText('Recheck'))
  await screen.findByText('marketing'); expect(mockRpc.mock.calls.map(([name]) => name)).toEqual([
    'read_workspace_screen_scope', 'read_workspace_screen_scope','get_my_site_capabilities',
  ]); expect(screen.getByTestId('admission')).toHaveTextContent('legacy')
})