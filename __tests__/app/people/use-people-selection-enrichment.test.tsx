import { act, renderHook } from '@testing-library/react'
import { apiClient } from '@/app/services/api-client-service'
import { usePeopleSelectionEnrichment } from '@/app/people/use-people-selection-enrichment'
import { deferred } from './test-helpers'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn() } }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

function setup() {
  let revision = 0
  const setSelectedPersonIds = jest.fn()
  const { result, rerender } = renderHook(({ ids }) => usePeopleSelectionEnrichment({
    currentSite: { id: 'site-a' } as NonNullable<Parameters<typeof usePeopleSelectionEnrichment>[0]['currentSite']>,
    selectedPersonIds: ids, setSelectedPersonIds, setIsConfirmModalOpen: jest.fn(), setIsEnriching: jest.fn(),
    captureResultScope: () => {
      const opening = revision
      return () => revision === opening
    },
  }), { initialProps: { ids: ['person-a', 'person-b'] } })
  return { result, rerender, setSelectedPersonIds, retire: () => { revision++ } }
}

beforeEach(() => jest.mocked(apiClient.post).mockReset())

it('submits only the selection that was confirmed and preserves unrelated selected rows', async () => {
  const { result, rerender, setSelectedPersonIds } = setup()
  jest.mocked(apiClient.post).mockResolvedValue({ success: true })
  act(() => result.current.openEnrichConfirmation())
  rerender({ ids: ['person-a', 'person-c'] })
  await act(async () => result.current.handleEnrich())
  expect(jest.mocked(apiClient.post).mock.calls.map(([, body]) => body.person_id)).toEqual(['person-a', 'person-b'])
  const clearCompleted = setSelectedPersonIds.mock.calls[0][0]
  expect(clearCompleted(['person-a', 'person-c'])).toEqual(['person-c'])
})

it('refuses a stale confirmation even if an old submit handler is called', async () => {
  const { result, retire } = setup()
  act(() => result.current.openEnrichConfirmation())
  const stale = result.current.handleEnrich
  retire()
  await act(async () => stale())
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('does not admit the rest of a batch or clear a new selection after a scope change', async () => {
  const { result, retire, setSelectedPersonIds } = setup()
  const first = deferred<{ success: true }>()
  jest.mocked(apiClient.post).mockReturnValueOnce(first.promise)
  act(() => result.current.openEnrichConfirmation())
  let submit!: Promise<void>
  act(() => { submit = result.current.handleEnrich(); void result.current.handleEnrich() })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  retire()
  await act(async () => { first.resolve({ success: true }); await submit })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(setSelectedPersonIds).not.toHaveBeenCalled()
})