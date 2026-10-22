import { renderHook } from '@testing-library/react'
import { createClient } from '@/utils/supabase/client'
import { getUserData } from '@/app/services/user-service'
import { enrichTasks, useControlCenterData, type TasksBundle } from '@/app/control-center/hooks/useControlCenterData'
import type { TaskQueryRow } from '@/app/control-center/task-data'

const mockFetchers = new Map<string, () => Promise<unknown>>()
let mockBundle: TasksBundle | undefined

jest.mock('@/utils/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/services/user-service', () => ({ getUserData: jest.fn() }))
jest.mock('@/app/services/site-members-service', () => ({ siteMembersService: {} }))
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: [string, string] | null, fetcher: (key: [string, string]) => Promise<unknown>) => {
    if (key) mockFetchers.set(key[0], () => fetcher(key))
    return {
      data: key?.[0] === 'control-center-tasks' ? mockBundle : undefined,
      isLoading: false,
      mutate: jest.fn(),
    }
  },
}))

const statuses = ['pending', 'in_progress', 'completed', 'failed', 'canceled'] as const
const task = (overrides: Partial<TaskQueryRow> = {}): TaskQueryRow => ({
  id: 'task', serial_id: 'T-1', title: 'Follow up', description: null,
  status: 'pending', scheduled_date: '2026-01-01', priority: 2,
  site_id: 'site-a', created_at: '2026-01-01', updated_at: '2026-01-01',
  lead_id: null, assignee: null, type: null, stage: null, ...overrides,
})

type Response = { data: TaskQueryRow[] | null; count: number | null; error: unknown }
function mockQueries(responses: Response[]) {
  let active = 0
  let maxActive = 0
  const builders: Array<{
    select: jest.Mock; eq: jest.Mock; order: jest.Mock; limit: jest.Mock
  }> = []
  const from = jest.fn(() => {
    const builder = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn(async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await Promise.resolve()
        active--
        return responses.shift()
      }),
    }
    builders.push(builder)
    return builder
  })
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  return { from, builders, maxActive: () => maxActive }
}

beforeEach(() => {
  jest.resetAllMocks()
  mockFetchers.clear()
  mockBundle = undefined
  jest.mocked(getUserData).mockResolvedValue({ name: 'Assigned Member', avatar_url: null })
})

it('uses five sequential bounded selects with exact totals, original order and initial pagination', async () => {
  const counts = [120, 50, 51, 0, 1]
  const queries = mockQueries(statuses.map((status, i) => ({
    data: counts[i] ? [task({ id: status, status, type: i === 0 ? 'outreach' : 'review' })] : [],
    count: counts[i], error: null,
  })))
  const { result, rerender } = renderHook(() => useControlCenterData('site-a'))
  mockBundle = await mockFetchers.get('control-center-tasks')!() as TasksBundle
  rerender()
  expect(queries.from).toHaveBeenCalledTimes(5)
  expect(queries.maxActive()).toBe(1)
  queries.builders.forEach((builder, i) => {
    expect(queries.from).toHaveBeenNthCalledWith(i + 1, 'tasks')
    expect(builder.select).toHaveBeenCalledWith(expect.stringContaining('comments_count:task_comments(count)'), { count: 'exact' })
    expect(builder.select.mock.calls[0][0]).toContain('leads:leads!tasks_lead_id_fkey')
    expect(builder.select.mock.calls[0][0]).not.toContain('leads:lead_id')
    expect(builder.eq.mock.calls).toEqual([['site_id', 'site-a'], ['status', statuses[i]]])
    expect(builder.order.mock.calls).toEqual([['priority', { ascending: false }], ['scheduled_date', { ascending: true }]])
    expect(builder.limit).toHaveBeenCalledWith(50)
    expect(result.current.totalCounts[statuses[i]]).toBe(counts[i])
    expect(result.current.initialKanbanPagination?.[statuses[i]]).toEqual({ page: 1, hasMore: counts[i] > 50, isLoading: false })
  })
  expect(result.current.tasks.map((row) => row.id)).toEqual(['pending', 'in_progress', 'completed', 'canceled'])
  expect(result.current.taskTypes).toEqual(['outreach', 'review'])
})

it('propagates forbidden errors without continuing queries or enriching unauthorized rows', async () => {
  const forbidden = { code: '42501', message: 'permission denied' }
  const queries = mockQueries([
    { data: [task({ assignee: 'member' })], count: 1, error: null },
    { data: null, count: null, error: forbidden },
  ])
  renderHook(() => useControlCenterData('site-a'))
  await expect(mockFetchers.get('control-center-tasks')!()).rejects.toBe(forbidden)
  expect(queries.from).toHaveBeenCalledTimes(2)
  expect(getUserData).not.toHaveBeenCalled()
})

it('keeps null counts and empty result sets at zero', async () => {
  mockQueries(statuses.map(() => ({ data: null, count: null, error: null })))
  renderHook(() => useControlCenterData('site-a'))
  const bundle = await mockFetchers.get('control-center-tasks')!() as TasksBundle
  expect(bundle.tasks).toEqual([])
  expect(bundle.totalCounts).toEqual(Object.fromEntries(statuses.map((status) => [status, 0])))
  expect(getUserData).not.toHaveBeenCalled()
})

it('deduplicates 250 tasks and bounds assignee lookup concurrency at four', async () => {
  let active = 0
  let maxActive = 0
  jest.mocked(getUserData).mockImplementation(async (id) => {
    active++
    maxActive = Math.max(maxActive, active)
    await Promise.resolve()
    active--
    return { name: `Name ${id}`, avatar_url: null }
  })
  const rows = Array.from({ length: 250 }, (_, i) => task({ id: `task-${i}`, assignee: `member-${i % 9}` }))
  const enriched = await enrichTasks(rows)
  expect(getUserData).toHaveBeenCalledTimes(9)
  expect(new Set(jest.mocked(getUserData).mock.calls.map(([id]) => id)).size).toBe(9)
  expect(maxActive).toBe(4)
  expect(enriched.map((row) => row.id)).toEqual(rows.map((row) => row.id))
  enriched.forEach((row, i) => expect(row.assigneeName).toBe(`Name member-${i % 9}`))
})

it('preserves association/display fields and fallback names, without caching across loads', async () => {
  const fallback = 'Team Member (missing...)'
  jest.mocked(getUserData).mockResolvedValueOnce({ name: fallback, avatar_url: null }).mockResolvedValueOnce(null)
  const rows = [task({
    assignee: 'missing', lead_id: 'lead', leads: { id: 'lead', name: 'Lead Name' },
    category_id: 'category', type: 'outreach', stage: 'decision', comments_count: [{ count: 7 }],
  }), task({ id: 'unassigned' }), task({ id: 'null-user', assignee: 'null-user', stage: 'unknown', comments_count: [] })]
  const enriched = await enrichTasks(rows)
  expect(enriched[0]).toMatchObject({
    id: 'task', title: 'Follow up', priority: 2, scheduled_date: '2026-01-01',
    lead_id: 'lead', leads: { id: 'lead', name: 'Lead Name' }, leadName: 'Lead Name',
    assignee: 'missing', assigneeName: fallback, category_id: 'category', type: 'outreach', stage: 'decision', comments_count: 7,
  })
  expect(enriched[1]).toMatchObject({ assignee: undefined, assigneeName: undefined, lead_id: undefined, comments_count: 0 })
  expect(enriched[2]).toMatchObject({ assigneeName: undefined, stage: undefined, comments_count: 0 })
  jest.mocked(getUserData).mockResolvedValue({ name: 'New session name', avatar_url: null })
  expect((await enrichTasks([task({ assignee: 'missing', site_id: 'site-b' })]))[0].assigneeName).toBe('New session name')
  expect(getUserData).toHaveBeenCalledTimes(3)
})

it('uses the same deduplication for fetchAllTasksForSite and keeps site scoping', async () => {
  const rows = [task({ assignee: 'member' }), task({ id: 'second', assignee: 'member' })]
  const builder = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(), data: rows, error: null,
  }
  jest.mocked(createClient).mockReturnValue({ from: jest.fn(() => builder) } as unknown as ReturnType<typeof createClient>)
  const { result } = renderHook(() => useControlCenterData(undefined))
  const enriched = await result.current.fetchAllTasksForSite('site-b')
  expect(builder.eq).toHaveBeenCalledWith('site_id', 'site-b')
  expect(getUserData).toHaveBeenCalledTimes(1)
  expect(enriched.map((row) => row.assigneeName)).toEqual(['Assigned Member', 'Assigned Member'])
  expect(mockFetchers.size).toBe(0)
})