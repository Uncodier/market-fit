import { act, renderHook } from '@testing-library/react'
import { useWorkspaceAdmission, WORKSPACE_ADMISSION_INTERVAL_MS } from '@/app/context/use-workspace-admission'

const scope = { actorId: 'member', siteId: 'a1000000-0000-4000-8000-000000000001' }
const mockRole = jest.fn()
const mockGetUser = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  rpc: () => ({ retry: () => ({ abortSignal: mockRole }) }), auth: { getUser: mockGetUser },
}) }))

beforeEach(() => {
  jest.useFakeTimers()
  mockRole.mockReset().mockResolvedValue({ data: 'collaborator', error: null })
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: scope.actorId } }, error: null })
})
afterEach(() => jest.useRealTimers())

it('detects an effective-role loss in an already-open workspace without a realtime event', async () => {
  const onLost = jest.fn()
  renderHook(() => useWorkspaceAdmission(scope, onLost))
  await act(async () => jest.advanceTimersByTimeAsync(0))
  expect(onLost).not.toHaveBeenCalled()
  mockRole.mockResolvedValue({ data: null, error: null })
  await act(async () => jest.advanceTimersByTimeAsync(WORKSPACE_ADMISSION_INTERVAL_MS))
  expect(onLost).toHaveBeenCalledTimes(1)
  expect(onLost).toHaveBeenCalledWith(scope)
  expect(mockGetUser).toHaveBeenCalledTimes(1)
})

it('does not leave on a transient failure, wrong actor, or a recovered role', async () => {
  const onLost = jest.fn()
  mockRole.mockResolvedValueOnce({ data: null, error: { code: '57014' } })
  renderHook(() => useWorkspaceAdmission(scope, onLost))
  await act(async () => jest.advanceTimersByTimeAsync(0))
  expect(mockGetUser).not.toHaveBeenCalled()
  mockRole.mockResolvedValueOnce({ data: null, error: null })
  mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'other' } }, error: null })
  await act(async () => { window.dispatchEvent(new Event('online')) })
  mockRole.mockResolvedValueOnce({ data: null, error: null })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  expect(mockGetUser).toHaveBeenCalledTimes(2)
  expect(onLost).not.toHaveBeenCalled()
})

it('ignores a denial that settles after switching projects', async () => {
  const onLost = jest.fn()
  let finish!: (result: object) => void
  mockRole.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { rerender } = renderHook(({ selected }) => useWorkspaceAdmission(selected, onLost), { initialProps: { selected: scope } })
  const oldSignal = mockRole.mock.calls[0][0]
  rerender({ selected: { ...scope, siteId: 'b1000000-0000-4000-8000-000000000002' } })
  await act(async () => finish({ data: null, error: null }))
  expect(oldSignal.aborted).toBe(true)
  expect(onLost).not.toHaveBeenCalled()
})