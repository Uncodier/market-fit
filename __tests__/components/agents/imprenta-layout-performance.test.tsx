import { renderHook } from "@testing-library/react"
import { useImprentaLayoutEffects } from "@/app/components/agents/imprenta-panel/layout-effects"
import { useImprentaMedia } from "@/app/components/agents/imprenta-panel/media"
import { useImprentaLayout } from "@/app/components/agents/imprenta-panel/graph-layout"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { Dispatch, SetStateAction } from "react"

type Options = Parameters<typeof useImprentaLayoutEffects>[0]
type Positions = Options["positions"]
const node = (id: string, settings: InstanceNode["settings"] = {}, parent_node_id: string | null = null) => ({
  id, settings, parent_node_id, type: "prompt", prompt: {}, result: {}, status: "pending",
} as InstanceNode)

function setup(nodes: InstanceNode[], positions: Positions) {
  const getLayoutPositions = jest.fn((_nodes, next: Positions) => next)
  const setPositions = jest.fn<ReturnType<Dispatch<SetStateAction<Positions>>>, Parameters<Dispatch<SetStateAction<Positions>>>>()
  const options = {
    nodes, dummyNodes: [], positions, setPositions, getLayoutPositions,
    nodeHeightsRef: { current: {} }, nodeHeightsSnapshot: {}, draggingNodeRef: { current: null },
    NODE_W: 480, ROW_H: 300, handleExecuteNode: jest.fn(),
  } as unknown as Options
  const view = renderHook(input => useImprentaLayoutEffects(input), { initialProps: options })
  const flushPositions = () => {
    const update = setPositions.mock.calls.at(-1)![0]
    return typeof update === "function" ? update(positions) : update
  }
  return { ...view, options, getLayoutPositions, setPositions, flushPositions }
}

it("preserves the positions object on content/status-only edits", () => {
  const positions = { a: { x: 100, y: 100 } }
  const view = setup([node("a", { ui_position: positions.a })], positions)
  expect(view.flushPositions()).toBe(positions)
  view.rerender({ ...view.options, nodes: [{ ...view.options.nodes[0], prompt: { text: "New prompt" }, status: "running" }] })
  expect(view.flushPositions()).toBe(positions)
  expect(view.getLayoutPositions).not.toHaveBeenCalled()
})

it("still applies server moves, removes stale nodes, and preserves dragged positions", () => {
  const positions = { a: { x: 100, y: 100 }, stale: { x: 600, y: 100 } }
  const view = setup([node("a", { ui_position: { x: 200, y: 300 } })], positions)
  expect(view.flushPositions()).toEqual({ a: { x: 200, y: 300 } })
  expect(view.getLayoutPositions).toHaveBeenCalledTimes(1)
  view.rerender({ ...view.options, draggingNodeRef: { current: "a" } })
  // The setter observes the current drag ref, not a captured drag ID.
  view.options.draggingNodeRef.current = "a"
  expect(view.flushPositions()).toEqual({ a: positions.a })
})

it("does not move a child back onto a copied parent position", () => {
  const positions = { parent: { x: 100, y: 100 }, child: { x: 650, y: 100 } }
  const view = setup([
    node("parent", { ui_position: positions.parent }),
    node("child", { ui_position: positions.parent }, "parent"),
  ], positions)
  expect(view.flushPositions()).toBe(positions)
  expect(view.getLayoutPositions).not.toHaveBeenCalled()
})

it("keeps action dispatchers stable and calls the latest committed handlers", async () => {
  const parent = node("parent")
  const child = node("child", {}, "parent")
  const view = setup([parent, child], { parent: { x: 0, y: 0 }, child: { x: 500, y: 0 } })
  const actions = view.result.current.actions
  const execute = jest.fn()
  const changedParent = { ...parent, prompt: { text: "Latest" } }
  view.rerender({ ...view.options, nodes: [changedParent, child], handleExecuteNode: execute })
  expect(view.result.current.actions).toBe(actions)
  await actions.handleExecuteNode(child)
  expect(execute).toHaveBeenCalledWith(child)
  expect(view.options.handleExecuteNode).not.toHaveBeenCalled()
  expect(actions.getParentNode(child)).toBe(changedParent)
})

it("keeps the media renderer stable across panel rerenders", () => {
  const setZoomedMedia = jest.fn()
  const view = renderHook(() => useImprentaMedia({ setZoomedMedia }))
  const renderer = view.result.current.renderMediaWithZoom
  view.rerender()
  expect(view.result.current.renderMediaWithZoom).toBe(renderer)
})

it("reuses the layout calculator and geometry when the measured graph does not move", () => {
  const options = { sidebarWidth: 64, contexts: [], nodeHeightsRef: { current: {} } }
  const view = renderHook(() => useImprentaLayout(options))
  const layout = view.result.current.getLayoutPositions
  const nodes = [node("root")]
  const positions = layout(nodes, {})
  expect(layout(nodes, positions)).toBe(positions)
  view.rerender()
  expect(view.result.current.getLayoutPositions).toBe(layout)
  const expanded = layout([...nodes, node("child", {}, "root")], positions)
  expect(expanded).not.toBe(positions)
  expect(expanded.child).toBeDefined()
  expect(expanded.root).toBe(positions.root)
})