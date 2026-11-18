import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { useImprentaEditorState } from '@/app/components/agents/imprenta-panel/editor-state'
import { ImprentaCardEditor } from '@/app/components/agents/imprenta-panel/card-editor'
import { ImprentaNodePicker } from '@/app/components/agents/imprenta-panel/node-picker'
import type { ImprentaNodeCardProps } from '@/app/components/agents/imprenta-panel/card-types'
import type { InstanceNode } from '@/app/types/instance-nodes'
import { toast } from 'sonner'

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))
jest.mock('@/app/components/simple-messages-view/components/MediaParametersToolbar', () => ({ MediaParametersToolbar: () => null }))

const a: InstanceNode = { id: 'a', instance_id: 'one', type: 'prompt', prompt: { text: 'First prompt' }, settings: {}, result: {}, status: 'pending',
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null, site_id: 'site', user_id: 'actor', created_at: '2026-11-18', updated_at: '2026-11-18' }
const b = { ...a, id: 'b', prompt: { text: 'Second prompt' } }

it('keeps per-node drafts, retires selection across navigation, and does not clear newer drafts on late saves', () => {
  const view = renderHook(({ id, nodes }) => useImprentaEditorState(id, nodes), { initialProps: { id: 'one', nodes: [a, b] } })
  act(() => { view.result.current.activateEditor('a'); view.result.current.promptDrafts.set('a', 'Unsaved') })
  act(() => view.result.current.activateEditor('b'))
  expect(view.result.current.promptDrafts.get('a')).toBe('Unsaved')
  act(() => view.result.current.promptDrafts.set('a', 'Newer'))
  act(() => view.result.current.promptDrafts.saved('a', 'Unsaved'))
  expect(view.result.current.promptDrafts.get('a')).toBe('Newer')
  view.rerender({ id: 'one', nodes: [a] })
  expect(view.result.current.activeEditorNodeId).toBeNull()
  view.rerender({ id: 'two', nodes: [] })
  expect(view.result.current.promptDrafts.get('a')).toBeUndefined()
})

it('blurs before replacing the editor, keeps a failed-save draft and retries it on return', async () => {
  const save = jest.fn().mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValue({ error: null })
  const eq = jest.fn(() => Promise.resolve({ error: null }))
  const props = {
    hasResult: false, hasRealChildren: false, isGenerating: false, currentSite: null,
    textParams: {}, imageParams: {}, videoParams: {}, audioParams: {},
    supabase: { from: () => ({ update: () => ({ eq }) }) },
    actions: { isImprentaWorkflowActionNode: () => false, setNodes: jest.fn(), trackNodeSave: save },
  } as unknown as ImprentaNodeCardProps
  function Canvas() {
    const editor = useImprentaEditorState('one', [a, b])
    const selected = editor.activeEditorNodeId === 'b' ? b : a
    return <>
      <button onMouseDown={e => e.preventDefault()} onClick={() => editor.activateEditor(selected.id === 'a' ? 'b' : 'a')}>Switch</button>
      <div data-imprenta-editor><ImprentaCardEditor key={selected.id} {...props} node={selected} promptDrafts={editor.promptDrafts} /></div>
    </>
  }
  render(<Canvas />)
  const textarea = screen.getByRole('textbox')
  act(() => textarea.focus())
  fireEvent.input(textarea, { target: { value: 'Changed draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Switch' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('textbox')).toHaveValue('Second prompt')
  expect(toast.error).toHaveBeenCalledWith('Could not save the prompt. Your draft is kept in this canvas.')
  fireEvent.click(screen.getByRole('button', { name: 'Switch' }))
  expect(screen.getByRole('textbox')).toHaveValue('Changed draft')
  fireEvent.blur(screen.getByRole('textbox'))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
})

it('offers a bounded searchable keyboard path into canvas nodes', async () => {
  const onSelect = jest.fn()
  render(<ImprentaNodePicker nodes={[a, b]} onSelect={onSelect} />)
  fireEvent.click(screen.getByRole('button', { name: 'Find node' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Search canvas nodes' }), { target: { value: 'Second' } })
  expect(screen.queryByRole('button', { name: 'First prompt' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Second prompt' }))
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith('b'))
})