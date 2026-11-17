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