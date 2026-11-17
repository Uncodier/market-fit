import { act, renderHook, waitFor } from '@testing-library/react'
import { useRobotsController } from '@/app/robots/use-robots-controller'

let mockMode = 'agent'
const mockInstances = [
  { id: 'a', site_id: 'site', name: 'Agent' },
  { id: 'archived', site_id: 'site', name: 'Archived', is_archived: true },
]
const mockGetAllInstances = jest.fn(() => mockInstances)
const mockSetMode = jest.fn()
const mockRefreshRobots = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()
const mockNodes = jest.fn()
const mockIn = jest.fn()

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: mockFrom, rpc: mockRpc }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/RobotsContext', () => ({
  useRobots: () => ({
    getAllInstances: mockGetAllInstances,
    getInstanceById: (id: string) => mockInstances.find(instance => instance.id === id),
    refreshRobots: mockRefreshRobots, isLoading: false, refreshCount: 0,
  }),
}))
jest.mock('@/app/context/LayoutContext', () => ({
  useLayout: () => ({ isLayoutCollapsed: false, robotsViewMode: mockMode, setRobotsViewMode: mockSetMode }),
}))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', isDarkMode: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => false }))
jest.mock('@/app/robots/use-robots-billing-wake', () => ({ useRobotsBillingWake: () => {} }))
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(`mode=${mockMode}&instance=a`),
  usePathname: () => '/robots', useRouter: () => ({ replace: jest.fn() }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockMode = 'agent'
  mockNodes.mockResolvedValue({ data: [{ instance_id: 'a', type: 'agent' }, { instance_id: 'a', type: 'wf-step' }], error: null })
  mockFrom.mockImplementation(() => {
    const query = { select: () => query, in: mockIn, order: () => query, range: () => query, abortSignal: mockNodes }
    mockIn.mockReturnValue(query)
    return query
  })
})

it('reads only canvas counters across agent/canvas/workflow transitions without restarting equivalent reads', async () => {
  const view = renderHook(() => useRobotsController())
  await act(async () => {})
  expect(view.result.current.shouldFetchStats).toBe(false)
  expect(mockFrom).not.toHaveBeenCalled()
  expect(mockRpc).not.toHaveBeenCalled()

  mockMode = 'imprenta'
  view.rerender()
  await waitFor(() => expect(view.result.current.instanceStats.a?.nodes).toBe(1))
  expect(mockFrom.mock.calls).toEqual([['instance_nodes']])
  expect(mockIn).toHaveBeenCalledWith('instance_id', ['a'])
  const signal = mockNodes.mock.calls[0][0] as AbortSignal

  mockMode = 'workflow'
  view.rerender()
  expect(view.result.current.instanceStats.a.workflows).toBe(1)
  act(() => view.result.current.setIsBrowserModalOpen(true))
  expect(mockFrom).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)

  mockMode = 'agent'
  view.rerender()
  expect(view.result.current.instanceStats).toEqual({})
  mockNodes.mockResolvedValue({ data: [], error: null })
  mockMode = 'workflow'
  view.rerender()
  await waitFor(() => expect(view.result.current.instanceStats.a?.workflows).toBe(0))
  expect(mockFrom.mock.calls).toEqual([['instance_nodes'], ['instance_nodes']])
  expect(mockRpc).not.toHaveBeenCalled()
})

it('aborts an in-flight canvas read on agent mode and ignores its late response', async () => {
  let finish!: (value: { data: { instance_id: string; type: string }[]; error: null }) => void
  mockNodes.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  mockMode = 'imprenta'
  const view = renderHook(() => useRobotsController())
  const signal = mockNodes.mock.calls[0][0] as AbortSignal
  mockMode = 'agent'
  view.rerender()
  expect(signal.aborted).toBe(true)
  await act(async () => finish({ data: [{ instance_id: 'a', type: 'agent' }], error: null }))
  expect(view.result.current.instanceStats).toEqual({})
  mockMode = 'workflow'
  view.rerender()
  await waitFor(() => expect(view.result.current.instanceStats.a?.workflows).toBe(1))
  expect(mockFrom.mock.calls).toEqual([['instance_nodes'], ['instance_nodes']])
  expect(mockRpc).not.toHaveBeenCalled()
})