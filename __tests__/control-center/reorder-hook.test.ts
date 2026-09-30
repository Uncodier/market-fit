import { act, renderHook } from '@testing-library/react'
import { toast } from 'react-hot-toast'
import { useSite } from '@/app/context/SiteContext'
import { createClient } from '@/utils/supabase/client'
import { useControlCenterPage } from '@/app/control-center/hooks/useControlCenterPage'

const mockRefreshTasks = jest.fn()
const mockRpc = jest.fn()
const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/hooks/use-mobile-view', () => ({ useIsMobile: () => false }))
jest.mock('@/app/hooks/use-auto-collapse-sidebar', () => ({ useAutoCollapseSidebar: () => [false, jest.fn()] }))
jest.mock('@/app/hooks/use-command-k', () => ({ useCommandK: jest.fn() }))
jest.mock('@/lib/navigation/navigation-helpers', () => ({ navigateToTask: jest.fn() }))
jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('@/app/control-center/hooks/useControlCenterData', () => ({
  useControlCenterData: () => ({
    categories: [], leads: [], users: [], tasks: [], taskTypes: [], totalCounts: {}, taskCounts: {},
    initialKanbanPagination: null, isLoading: false, refreshTasks: mockRefreshTasks, updateTasksCache: jest.fn(),
  }),
  enrichTasks: jest.fn(),
}))

describe('control-center reorder caller', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const builder = { update: mockUpdate, eq: mockEq, error: null }
    mockFrom.mockReturnValue(builder)
    mockUpdate.mockReturnValue(builder)
    mockEq.mockReturnValue(builder)
    mockRpc.mockResolvedValue({ data: undefined, error: null })
    mockRefreshTasks.mockResolvedValue(undefined)
    jest.mocked(createClient).mockReturnValue({ rpc: mockRpc, from: mockFrom } as unknown as ReturnType<typeof createClient>)
    jest.mocked(useSite).mockReturnValue({ currentSite: { id: 'site', user_id: 'owner' } } as ReturnType<typeof useSite>)
  })

  it('sends a 1-based p_new_position and refreshes only after the void RPC succeeds', async () => {
    const { result } = renderHook(() => useControlCenterPage())
    await act(async () => result.current.handleUpdateTaskStatus('task', 'completed', 2))
    expect(mockRpc).toHaveBeenCalledWith('reorder_task_priorities', {
      p_task_id: 'task', p_new_position: 2, p_status: 'completed', p_site_id: 'site',
    })
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1)
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(mockRefreshTasks.mock.invocationCallOrder[0])
  })

  it('surfaces RPC rejection without refreshing or falling back to a direct update', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Task not found', code: 'P0002' } })
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { result } = renderHook(() => useControlCenterPage())
      await act(async () => result.current.handleUpdateTaskStatus('task', 'pending', 1))
      expect(toast.error).toHaveBeenCalledWith('Failed to reorder task')
      expect(mockRefreshTasks).not.toHaveBeenCalled()
      expect(mockFrom).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('leaves status-only updates site-scoped and does not call reorder', async () => {
    const { result } = renderHook(() => useControlCenterPage())
    await act(async () => result.current.handleUpdateTaskStatus('task', 'completed'))
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith('tasks')
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'completed' })
    expect(mockEq.mock.calls).toEqual([['id', 'task'], ['site_id', 'site']])
    expect(mockRefreshTasks).toHaveBeenCalledTimes(1)
  })

  it('does not call the database for invalid statuses or an absent current site', async () => {
    const { result, rerender } = renderHook(() => useControlCenterPage())
    await act(async () => result.current.handleUpdateTaskStatus('task', 'done', 1))
    jest.mocked(useSite).mockReturnValue({ currentSite: null } as ReturnType<typeof useSite>)
    rerender()
    await act(async () => result.current.handleUpdateTaskStatus('task', 'pending', 1))
    expect(createClient).not.toHaveBeenCalled()
    expect(mockRefreshTasks).not.toHaveBeenCalled()
  })
})