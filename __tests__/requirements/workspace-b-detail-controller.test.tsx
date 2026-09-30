import { act, renderHook } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { createRequirementLoader } from '@/app/requirements/[id]/load-requirement-detail'
import { useRequirementState } from '@/app/requirements/[id]/use-requirement-state'
import { useRequirementWorkflow } from '@/app/requirements/[id]/use-requirement-workflow'
import { useRequirementLifecycle } from '@/app/requirements/[id]/use-requirement-lifecycle'
import type { RequirementDetailRow } from '@/app/requirements/[id]/requirement-detail-types'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: null, isLoading: false }) }))
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'requirement-1' }),
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@tiptap/react', () => ({ useEditor: () => null }))
jest.mock('@/app/requirements/actions', () => ({ updateRequirementStatus: jest.fn() }))

const row: RequirementDetailRow = {
  id: 'requirement-1', site_id: 'site-1', title: 'Draft', description: '',
  instructions: 'Saved instructions', type: 'document', priority: 'medium',
  status: 'backlog', completion_status: 'pending', source: '', budget: null,
  created_at: '2026-01-01T00:00:00Z',
  metadata: {
    workflow_nodes: [{ id: 'saved', type: 'trigger', position: { x: 5, y: 10 }, data: {} }],
    workflow_connections: [{ id: 'edge', from: 'saved', to: 'action', sourceHandle: 'success' }],
  },
  requirement_segments: [{ segment_id: 'segment-1' }],
  campaign_requirements: [{ campaign_id: 'campaign-1' }],
}

describe('extracted requirement detail behavior', () => {
  beforeEach(() => jest.clearAllMocks())

  it('loads saved graph and preserves the existing campaign selection', async () => {
    const from = jest.fn((table: string) => {
      if (table === 'requirements') return { select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }) }
      if (table === 'requirement_status') return { select: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: 'status' }], error: null }) }) }) }
      if (table === 'segments') return { select: () => ({ eq: async () => ({ data: [{ id: 'segment-1', name: 'Audience', description: '' }], error: null }) }) }
      if (table === 'campaigns') return { select: () => ({ eq: async () => ({ data: [{ id: 'campaign-1', title: 'Campaign', description: '', metadata: null }], error: null }) }) }
      throw new Error(`Unexpected table: ${table}`)
    })
    jest.mocked(createClient).mockReturnValue({ from })
    const { result } = renderHook(useRequirementState)
    await act(async () => { await createRequirementLoader(result.current)() })
    expect(result.current.editForm.campaignValue).toEqual({ mode: 'existing', id: 'campaign-1', label: 'Campaign' })
    expect(result.current.editForm.type).toBe('document')
    expect(result.current.nodes).toEqual(row.metadata?.workflow_nodes)
    expect(result.current.connections).toEqual(row.metadata?.workflow_connections)
    expect(result.current.hasRequirementStatus).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('undoes and redoes nodes together with their typed connections', () => {
    jest.useFakeTimers()
    const { result, unmount } = renderHook(() => {
      const state = useRequirementState()
      return { ...state, ...useRequirementWorkflow(state) }
    })
    act(() => result.current.handleAddNode('action'))
    act(() => jest.advanceTimersByTime(501))
    expect(result.current.nodes).toHaveLength(2)
    expect(result.current.connections).toHaveLength(1)
    const connection = result.current.connections[0]
    act(() => result.current.handleUndoWorkflow())
    expect(result.current.nodes).toHaveLength(1)
    expect(result.current.connections).toEqual([])
    act(() => result.current.handleRedoWorkflow())
    expect(result.current.nodes).toHaveLength(2)
    expect(result.current.connections).toEqual([connection])
    expect(result.current.unsavedChanges).toBe(true)
    unmount()
    jest.useRealTimers()
  })

  it('does not load protected data before authentication', () => {
    const load = jest.fn(async () => {})
    const save = jest.fn(async () => true)
    const build = jest.fn(async () => {})
    const { result } = renderHook(() => {
      const state = useRequirementState()
      useRequirementLifecycle(state, load, save, build)
      return state
    })
    expect(load).not.toHaveBeenCalled()
    expect(result.current.error).toBe('You must be signed in to view requirements')
    expect(result.current.isLoading).toBe(false)
  })
})