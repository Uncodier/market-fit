import { act, renderHook } from '@testing-library/react'
import { useBacklogManagement } from '@/app/components/simple-messages-view/hooks/useBacklogManagement'

const updateEq = jest.fn()
const update = jest.fn(() => ({ eq: updateEq }))
const from = jest.fn(() => ({ update }))

jest.mock('../../../lib/supabase/client', () => ({
  createClient: () => ({ from }),
}))

jest.mock('@/app/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

const sourceBacklog = {
  items: [
    { id: 'item-1', title: 'First requirement', status: 'pending' },
    { id: 'item-2', title: 'Second requirement', status: 'done' },
  ],
}

describe('useBacklogManagement', () => {
  beforeEach(() => {
    from.mockClear()
    update.mockClear()
    updateEq.mockReset()
    updateEq.mockResolvedValue({ error: null })
  })

  it('saves the edited title and updates local backlog immediately', async () => {
    const { result } = renderHook(() =>
      useBacklogManagement({
        activeRobotInstance: { id: 'inst-1', name: 'req-runner-req-123' },
        requirementIdFromStatus: 'req-123',
        sourceBacklog,
      })
    )

    act(() => {
      result.current.openEditBacklogModal(sourceBacklog.items[0])
    })
    act(() => {
      result.current.setEditBacklogTitle('Updated first requirement')
    })

    await act(async () => {
      await result.current.saveBacklogItem()
    })

    expect(from).toHaveBeenCalledWith('requirements')
    expect(update).toHaveBeenCalledWith({
      backlog: {
        items: [
          { id: 'item-1', title: 'Updated first requirement', status: 'pending' },
          { id: 'item-2', title: 'Second requirement', status: 'done' },
        ],
      },
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'req-123')
    expect(result.current.requirementBacklog).toEqual({
      items: [
        { id: 'item-1', title: 'Updated first requirement', status: 'pending' },
        { id: 'item-2', title: 'Second requirement', status: 'done' },
      ],
    })
    expect(result.current.isEditBacklogModalOpen).toBe(false)
  })

  it('resolves requirement id from the instance name when status id is missing', async () => {
    const { result } = renderHook(() =>
      useBacklogManagement({
        activeRobotInstance: { id: 'inst-1', name: 'req-maint-req-456' },
        sourceBacklog,
      })
    )

    act(() => {
      result.current.openEditBacklogModal(sourceBacklog.items[0])
    })

    await act(async () => {
      await result.current.saveBacklogItem()
    })

    expect(updateEq).toHaveBeenCalledWith('id', 'req-456')
  })
})
