import { renderHook } from "@testing-library/react"
import { useImprentaVirtualization } from "@/app/components/agents/imprenta-panel/virtualization"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import type { InstanceNode } from "@/app/types/instance-nodes"

it("invalidates viewport cells when a stationary card grows, without changing its position", () => {
  const nodes = [{ id: "a", type: "prompt", status: "completed", result: {} } as InstanceNode]
  const viewportStore = createViewportStore({ scale: 1, canvasWidth: 800, canvasHeight: 600 })
  const nodeHeightsRef = { current: { a: 300 } }
  const options: Parameters<typeof useImprentaVirtualization>[0] = {
    nodes, canvasNodes: nodes, dummyNodes: [], positions: { a: { x: 100, y: 100 } },
    nodeHeightsRef, layoutEpoch: 0, viewportInfo: viewportStore.get(),
    setViewportInfo: jest.fn(), viewportStore, viewportStoreRef: { current: viewportStore },
    hoverStore: createImprentaHoverStore(), isDarkMode: false,
    draggingNodeId: null, tempConnection: null, generatingNodeIds: new Set(),
  }
  const view = renderHook(props => useImprentaVirtualization(props), { initialProps: options })
  expect(view.result.current.visibleNodeIds?.has("a")).toBe(true)
  const position = view.result.current.stablePositions.a
  nodeHeightsRef.current.a = 1800
  view.rerender({ ...options, layoutEpoch: 1, viewportInfo: { ...viewportStore.get(), position: { x: 0, y: -1000 } } })
  expect(view.result.current.stablePositions.a).toBe(position)
  expect(view.result.current.visibleNodeIds?.has("a")).toBe(true)
  expect(view.result.current.domRenderNodes).toEqual(nodes)
  nodeHeightsRef.current.a = 300
  view.rerender({ ...options, layoutEpoch: 2, viewportInfo: { ...viewportStore.get(), position: { x: 0, y: -1000 } } })
  expect(view.result.current.visibleNodeIds?.has("a")).toBe(false)
})

it('does not mount a large graph before the first viewport and immediately mounts its drag origin', () => {
  const nodes = Array.from({ length: 166 }, (_, index) => ({
    id: `node-${index}`, type: 'prompt', status: 'pending', result: {},
  } as InstanceNode))
  const viewportStore = createViewportStore({ scale: 0.05, canvasWidth: 1440, canvasHeight: 1000 })
  const options: Parameters<typeof useImprentaVirtualization>[0] = {
    nodes, canvasNodes: nodes, dummyNodes: [],
    positions: Object.fromEntries(nodes.map((node, i) => [node.id, { x: (i % 30) * 600, y: Math.floor(i / 30) * 800 }])),
    nodeHeightsRef: { current: {} }, layoutEpoch: 0, viewportInfo: null,
    setViewportInfo: jest.fn(), viewportStore, viewportStoreRef: { current: viewportStore },
    hoverStore: createImprentaHoverStore(), isDarkMode: false,
    draggingNodeId: null, tempConnection: null, generatingNodeIds: new Set(),
  }
  const view = renderHook(props => useImprentaVirtualization(props), { initialProps: options })
  expect(view.result.current.domRenderNodes).toHaveLength(0)
  expect(view.result.current.mountedNodeIds.size).toBe(0)
  view.rerender({ ...options, viewportInfo: viewportStore.get(), draggingNodeId: 'node-165' })
  expect(view.result.current.slicedRenderNodes.map(node => node.id)).toContain('node-165')
  expect([...view.result.current.mountedNodeIds]).toEqual(view.result.current.slicedRenderNodes.map(node => node.id))
})