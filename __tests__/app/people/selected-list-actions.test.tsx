import { act, renderHook } from '@testing-library/react'
import { useSelectedListActions } from '@/app/people/use-selected-list-actions'
import { apiClient } from '@/app/services/api-client-service'
import { toast } from 'sonner'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn() } }))
jest.mock('@/app/people/use-saved-finder-lists', () => ({ useSavedFinderLists: () => ({
  lists: [{ id: 'list-a', name: 'My list' }], loading: false, error: false, refresh: jest.fn(),
}) }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const clear = jest.fn()
const refresh = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(apiClient.post as jest.Mock).mockReset()
})
function setup(ids = ['person-1', 'person-2']) {
  return renderHook(({ siteId }) => useSelectedListActions({ siteId,
    selectedPersonIds: ids, setSelectedPersonIds: clear, refreshIcps: refresh,
  }), { initialProps: { siteId: 'site-a' } })
}

it('adds selected provider IDs to an existing list without enriching now', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true, data: { list: { id: 'list-a' }, added_count: 2 } })
  const { result } = setup()
  act(() => { result.current.open('add') })
  act(() => { result.current.setListId('list-a') })
  await act(async () => { await result.current.submit() })
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/lists/list-a/people', {
    site_id: 'site-a', person_ids: ['person-1', 'person-2'], request_id: expect.any(String),
  }, { includeAuth: true })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(clear).toHaveBeenCalledTimes(1)
  expect(result.current.mode).toBeNull()
})

it('retains the request UUID on an uncertain save retry and preserves selection on error', async () => {
  ;(apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ success: true, data: { list: { id: 'new-list' }, added_count: 2 } })
  const { result } = setup()
  act(() => { result.current.open('create') })
  act(() => { result.current.setName('New list') })
  await act(async () => { await result.current.submit() })
  expect(result.current.mode).toBe('create')
  expect(clear).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith('Connection lost')
  await act(async () => { await result.current.submit() })
  const calls = (apiClient.post as jest.Mock).mock.calls
  expect(calls[0][1].request_id).toBe(calls[1][1].request_id)
})

it('blocks double submission and does not publish a save into another site', async () => {
  let resolve!: (value: unknown) => void
  ;(apiClient.post as jest.Mock).mockReturnValue(new Promise(done => { resolve = done }))
  const { result, rerender } = setup()
  act(() => { result.current.open('create') })
  act(() => { result.current.setName('New list') })
  let saving!: Promise<void>
  act(() => { saving = result.current.submit(); void result.current.submit() })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  rerender({ siteId: 'site-b' })
  await act(async () => { resolve({ success: true, data: { list: { id: 'new-list' }, added_count: 2 } }); await saving })
  expect(toast.success).not.toHaveBeenCalled()
  expect(clear).not.toHaveBeenCalled()
})

it('does not send an unavailable destination or more than 100 selected people', async () => {
  const { result } = setup()
  act(() => { result.current.open('add') })
  act(() => { result.current.setListId('foreign-list') })
  await act(async () => { await result.current.submit() })
  expect(apiClient.post).not.toHaveBeenCalled()
  const oversized = setup(Array.from({ length: 101 }, (_, index) => `person-${index}`))
  act(() => { oversized.result.current.open('create') })
  expect(oversized.result.current.mode).toBeNull()
  expect(toast.error).toHaveBeenCalledWith('Select up to 100 people at a time.')
})