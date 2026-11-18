import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ZoomableCanvas } from '@/app/components/agents/zoomable-canvas'
import { createViewportStore } from '@/app/lib/imprenta-viewport-store'
import { useImprentaDragging } from '@/app/components/agents/imprenta-panel/drag'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/components/ui/tooltip', () => {
  const Pass = ({ children }: any) => <>{children}</>
  return { Tooltip: Pass, TooltipProvider: Pass, TooltipTrigger: Pass, TooltipContent: () => null }
})

const bounds = { width: 23000, height: 10000 }
const ref = (current: any) => ({ current })
function dragOptions(store: ReturnType<typeof createViewportStore>) {
  const eq = jest.fn().mockResolvedValue({})
  const update = jest.fn(() => ({ eq }))
  return {
    viewportStore: store, draggingNodeRef: ref(null), nodeDragMovedRef: ref(false),
    dragStartPosRef: ref({ x: 0, y: 0 }), dragStartNodePosRef: ref({ x: 0, y: 0 }),
    lastNodeDragPosRef: ref(null), nodeElementsRef: ref({}), nodeDragRafRef: ref(null),
    nodeHeightsRef: ref({ node: 400 }), dragStore: { set: jest.fn() },
    setDraggingNodeId: jest.fn(), setPositions: jest.fn(),
    nodesRef: ref([{ id: 'node', settings: {} }]), setNodes: jest.fn(),
    supabase: { from: jest.fn(() => ({ update })) }, positionsRef: ref({ node: { x: 1000, y: 600 } }),
  }
}
function Hit({ options }: { options: ReturnType<typeof dragOptions> }) {
  const drag = useImprentaDragging(options as any)
  return <div data-testid="hit" onPointerDown={e => drag.handleCanvasNodePointerDown('node', e.nativeEvent)} />
}
async function settle(ms = 100) {
  await act(async () => { jest.advanceTimersByTime(ms) })
  await act(async () => { jest.advanceTimersByTime(32) })
}
function transform(content: HTMLElement) { return content.parentElement!.style.transform }

beforeEach(() => {
  jest.useFakeTimers()
  window.PointerEvent = MouseEvent as any
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200, height: 800, left: 0, top: 0 } as DOMRect)
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

it('publishes the fitted scale/position matching the committed DOM, including repeated fit', async () => {
  const store = createViewportStore()
  const observations: string[] = []
  const callback = jest.fn(info => {
    const content = screen.queryByTestId('content')
    if (content) observations.push(`${info.scale}:${transform(content)}`)
  })
  render(<ZoomableCanvas graphBounds={bounds} viewportStore={store} onViewportTransformChange={callback} fitOnChildrenChange={false}><div data-testid="content" /></ZoomableCanvas>)
  await settle()
  const fit = 1200 * .98 / 23000
  expect(store.get().scale).toBe(fit)
  expect(transform(screen.getByTestId('content'))).toContain(`scale(${fit})`)
  expect(observations.every(s => s.includes(`scale(${s.split(':')[0]})`))).toBe(true)
  act(() => store.requestFocus!({ x: 1240, y: 800 }))
  await settle(32)
  expect(store.get().scale).toBe(.7)
  fireEvent.click(screen.getByRole('button', { name: 'Fit to screen' }))
  await settle(32)
  expect(store.get().scale).toBe(fit)
  expect(transform(screen.getByTestId('content'))).toContain(`scale(${fit})`)
})

it('canvas click with jitter focuses a node at readable scale without any database writes', async () => {
  const store = createViewportStore()
  const options = dragOptions(store)
  render(<ZoomableCanvas graphBounds={bounds} viewportStore={store} fitOnChildrenChange={false} screenSpaceFront={<Hit options={options} />}><div data-testid="content" /></ZoomableCanvas>)
  await settle()
  fireEvent.pointerDown(screen.getByTestId('hit'), { button: 0, clientX: 60, clientY: 40 })
  fireEvent.pointerMove(window, { clientX: 62, clientY: 41 })
  fireEvent.pointerUp(window)
  await settle(32)
  expect(store.get().scale).toBe(.7)
  expect(store.get().position).toEqual({ x: 600 - 1240 * .7, y: 400 - 800 * .7 })
  expect(transform(screen.getByTestId('content'))).toBe(`translate3d(${600 - 1240 * .7}px, ${400 - 800 * .7}px, 0) scale(0.7)`)
  expect(options.supabase.from).not.toHaveBeenCalled()
  expect(options.setPositions).not.toHaveBeenCalled()
})

it('actual drag persists the world-space delta and does not focus', async () => {
  const store = createViewportStore({ scale: .05 })
  const options = dragOptions(store)
  const focus = jest.spyOn(store, 'requestFocus')
  render(<Hit options={options} />)
  fireEvent.pointerDown(screen.getByTestId('hit'), { button: 0, clientX: 60, clientY: 40 })
  fireEvent.pointerMove(window, { clientX: 70, clientY: 45 })
  fireEvent.pointerUp(window)
  await settle(32)
  expect(focus).not.toHaveBeenCalled()
  expect(options.supabase.from).toHaveBeenCalledWith('instance_nodes')
  expect(options.supabase.from().update).toHaveBeenCalledWith({ settings: { ui_position: { x: 1200, y: 700 } } })
})

it('preserves ctrl-wheel focal zoom and opt-in plain wheel panning', async () => {
  const store = createViewportStore()
  render(<ZoomableCanvas graphBounds={bounds} viewportStore={store} fitOnChildrenChange={false} enableWheelPan><div data-testid="content" /></ZoomableCanvas>)
  await settle()
  const content = screen.getByTestId('content')
  const canvas = content.parentElement!.parentElement!
  const before = store.get()
  fireEvent.wheel(canvas, { ctrlKey: true, deltaY: -20, clientX: 300, clientY: 200 })
  await settle(32)
  expect(store.get().scale).toBeCloseTo(before.scale * Math.exp(.1))
  expect(transform(content)).toContain(`scale(${store.get().scale})`)
  const position = store.get().position
  fireEvent.wheel(canvas, { deltaY: 30, deltaX: 10 })
  await settle(32)
  expect(store.get().position).toEqual({ x: position.x - 10, y: position.y - 30 })
})

it('keeps viewport-fill fit at the origin and leaves plain wheel alone by default', async () => {
  const store = createViewportStore()
  render(<ZoomableCanvas graphBounds={bounds} viewportStore={store} measureAsViewportFill fitOnChildrenChange={false}><div data-testid="content" /></ZoomableCanvas>)
  await settle()
  expect(store.get().position).toEqual({ x: 0, y: 0 })
  const content = screen.getByTestId('content')
  const before = transform(content)
  const wheel = new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true })
  fireEvent(content.parentElement!.parentElement!, wheel)
  await settle(32)
  expect(wheel.defaultPrevented).toBe(false)
  expect(transform(content)).toBe(before)
})

it('does not mutate a snapshot for a focus request without a mounted canvas owner', () => {
  const store = createViewportStore({ scale: .05 })
  const snapshot = store.get()
  store.requestFocus!({ x: 1240, y: 800 })
  expect(store.get()).toBe(snapshot)
})
