import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useMemo, useState } from 'react'
import { AUTO_EDITOR_BATCH, AUTO_EDITOR_LIMIT, closeEditorZoom, nearbyEditorIds, useAutomaticEditors } from '@/app/components/agents/imprenta-panel/automatic-editors'
import { useImprentaVirtualization } from '@/app/components/agents/imprenta-panel/virtualization'
import { useImprentaEditorState } from '@/app/components/agents/imprenta-panel/editor-state'
import { createViewportStore } from '@/app/lib/imprenta-viewport-store'
import { createImprentaHoverStore } from '@/app/lib/imprenta-hover-store'
import type { InstanceNode } from '@/app/types/instance-nodes'
import type { ZoomableViewportInfo } from '@/app/components/agents/zoomable-canvas'

const nodes: InstanceNode[] = Array.from({ length: 166 }, (_, i) => ({
  id: `n-${i}`, instance_id: 'one', site_id: 'site', user_id: 'actor',
  type: 'prompt', status: 'pending', settings: {}, prompt: { text: `Prompt ${i}` }, result: {},
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null, created_at: '', updated_at: '',
}))
const positions = Object.fromEntries(nodes.map((node, i) => [node.id, { x: (i % 15) * 530, y: Math.floor(i / 15) * 340 }]))
const view = (scale: number, x = 0): ZoomableViewportInfo => ({ scale, position: { x, y: 0 }, canvasWidth: 1800, canvasHeight: 1100 })
const heights: Record<string, number> = {}
let frames: Map<number, FrameRequestCallback>
let nextFrame: number
const frame = () => act(() => {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach(callback => callback(0))
})

beforeEach(() => {
  frames = new Map(); nextFrame = 0
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
})
afterEach(() => jest.restoreAllMocks())

it('has separate enter/exit thresholds and rejects invalid zoom', () => {
  expect(closeEditorZoom(false, .84)).toBe(false)
  expect(closeEditorZoom(false, .85)).toBe(true)
  expect(closeEditorZoom(true, .75)).toBe(true)
  expect(closeEditorZoom(true, .64)).toBe(false)
  expect(closeEditorZoom(false, .75)).toBe(false)
  expect(closeEditorZoom(true, NaN)).toBe(false)
})

it('chooses only truly visible forms, prioritizes the center, and excludes dummies', () => {
  const fixture = [nodes[0], nodes[1], { ...nodes[2], id: 'dummy-1' }]
  const pos = { 'n-0': { x: 0, y: 0 }, 'n-1': { x: 1810, y: 0 }, 'dummy-1': { x: 800, y: 300 } }
  expect(nearbyEditorIds(fixture, pos, heights, view(1))).toEqual(['n-0'])
  expect(nearbyEditorIds(nodes, positions, heights, view(1))).toHaveLength(AUTO_EDITOR_LIMIT)
  expect(nearbyEditorIds(nodes, positions, heights, null)).toEqual([])
})

it('mounts two forms per frame, stays stable near the threshold, and releases all on zoom-out', () => {
  const store = createViewportStore(view(.5))
  const props = { enabled: true, scope: 'one', nodes, positions, heights, viewport: view(.5), store }
  const h = renderHook(p => useAutomaticEditors(p), { initialProps: props })
  expect(h.result.current.size).toBe(0)
  act(() => store.set(view(1)))
  h.rerender({ ...props, viewport: view(1) })
  expect(h.result.current.size).toBe(0)
  frame(); expect(h.result.current.size).toBe(AUTO_EDITOR_BATCH)
  frame(); expect(h.result.current.size).toBe(4)
  frame(); frame(); expect(h.result.current.size).toBe(AUTO_EDITOR_LIMIT)
  h.rerender({ ...props, viewport: view(.75) })
  for (let i = 0; i < 5; i++) frame()
  expect(h.result.current.size).toBeGreaterThan(0)
  h.rerender({ ...props, viewport: view(.6) })
  expect(h.result.current.size).toBe(0)
  frame()
  h.rerender({ ...props, viewport: view(.75) })
  frame(); expect(h.result.current.size).toBe(0)
})

it('does not mount while interacting and exits on a live zoom crossing before settlement', () => {
  const store = createViewportStore({ ...view(1), interacting: true })
  const props = { enabled: true, scope: 'one', nodes, positions, heights, viewport: view(1), store }
  const h = renderHook(p => useAutomaticEditors(p), { initialProps: props })
  frame(); expect(h.result.current.size).toBe(0)
  act(() => store.setInteracting(false)); frame(); frame()
  expect(h.result.current.size).toBe(2)
  act(() => store.set({ scale: .5, interacting: true })); frame()
  expect(h.result.current.size).toBe(0)
  frame(); expect(h.result.current.size).toBe(0)
  h.rerender({ ...props, viewport: view(.5) })
  act(() => store.set({ ...view(1), interacting: false }))
  h.rerender({ ...props, viewport: view(1) }); frame(); frame(); frame()
  expect(h.result.current.size).toBeGreaterThan(0)
})

it('drops offscreen and old-scope forms immediately, never retaining a mounting budget for the whole graph', () => {
  const store = createViewportStore(view(1))
  const props = { enabled: true, scope: 'one', nodes, positions, heights, viewport: view(1), store }
  const h = renderHook(p => useAutomaticEditors(p), { initialProps: props })
  for (let i = 0; i < 5; i++) frame()
  const old = [...h.result.current]
  h.rerender({ ...props, viewport: view(1, -5000) })
  expect(h.result.current.size).toBe(0)
  frame(); expect(h.result.current.size).toBe(2)
  expect([...h.result.current].every(id => !old.includes(id))).toBe(true)
  h.rerender({ ...props, scope: 'two' })
  expect(h.result.current.size).toBe(0)
  h.unmount(); expect(frames.size).toBe(0)
})

it('keeps the typing card through demotion without stealing focus, then releases it on blur', async () => {
  const store = createViewportStore(view(1))
  const saved = jest.fn()
  function Canvas() {
    const editor = useImprentaEditorState('one', nodes)
    const [viewportInfo, setViewportInfo] = useState<ZoomableViewportInfo | null>(view(1))
    const stable = useMemo(() => ({ nodeHeightsRef: { current: {} }, viewportStoreRef: { current: store }, hoverStore: createImprentaHoverStore(),
      dummyNodes: [] as InstanceNode[], generatingNodeIds: new Set<string>() }), [])
    const result = useImprentaVirtualization({ ...stable, ...editor, activeInstanceId: 'one', nodes, canvasNodes: nodes, positions,
      layoutEpoch: 0, viewportInfo, setViewportInfo, viewportStore: store, isDarkMode: false, draggingNodeId: null, tempConnection: null })
    return <><button>Outside</button>{result.slicedRenderNodes.map(node =>
      <div key={node.id} data-imprenta-editable-node={node.id}>
        <textarea aria-label={node.id} defaultValue={editor.promptDrafts.get(node.id) ?? node.prompt.text}
          onInput={e => editor.promptDrafts.set(node.id, e.currentTarget.value)} onBlur={saved} />
      </div>)}</>
  }
  render(<Canvas />)
  const outside = screen.getByRole('button', { name: 'Outside' })
  act(() => outside.focus())
  for (let i = 0; i < 5; i++) frame()
  expect(document.activeElement).toBe(outside)
  expect(screen.getAllByRole('textbox')).toHaveLength(AUTO_EDITOR_LIMIT)
  const input = screen.getAllByRole('textbox')[0]
  act(() => input.focus())
  fireEvent.input(input, { target: { value: 'Keep my draft' } })
  act(() => store.set({ ...view(.5), interacting: true })); frame(); frame()
  expect(screen.getAllByRole('textbox')).toEqual([input])
  expect(input).toHaveFocus(); expect(input).toHaveValue('Keep my draft')
  act(() => outside.focus())
  await act(async () => {})
  frame()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(saved).toHaveBeenCalledTimes(1)
})