import { fireEvent, render, renderHook, screen } from "@testing-library/react"
import { ImprentaNodeCardInner } from "@/app/components/agents/imprenta-panel/node-card"
import { useImprentaCardData } from "@/app/components/agents/imprenta-panel/card-data"
import { TooltipProvider } from "@/app/components/ui/tooltip"
import type { ImprentaNodeCardProps } from "@/app/components/agents/imprenta-panel/card-types"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaContext, ImprentaLog } from "@/app/components/agents/imprenta-panel/data-types"

const mockEditor = jest.fn(({ node, hasRealChildren }: ImprentaNodeCardProps) =>
  <div data-testid={node.id}>{hasRealChildren ? "locked" : "editable"}</div>)
jest.mock("@/app/components/agents/imprenta-panel/card-editor", () => ({
  ImprentaCardEditor: (props: ImprentaNodeCardProps) => mockEditor(props),
}))
jest.mock("@/app/components/agents/imprenta-panel/card-result", () => ({ ImprentaCardResult: () => null }))
jest.mock("@/app/components/agents/imprenta-panel/card-actions", () => ({
  ImprentaCardActions: ({ node, actions }: ImprentaNodeCardProps) =>
    <button onClick={() => actions.handleExecuteNode(node)}>Run {node.id}</button>,
}))

const node = (id: string, parent_node_id: string | null = null): InstanceNode => ({
  id, parent_node_id, instance_id: "instance-a", site_id: "site-a", user_id: "actor",
  original_node_id: null, parent_instance_log_id: null, type: "prompt", status: "pending",
  prompt: { text: id }, settings: {}, result: {}, created_at: "2026-11-16", updated_at: "2026-11-16",
})
const empty: InstanceNode[] = []
const contexts: ImprentaContext[] = []
const logs: ImprentaLog[] = []

it("keeps unrelated cards memoized while updating the edited node and child locks", () => {
  const execute = jest.fn()
  const shared = {
    pos: { x: 0, y: 0 }, isDragging: false, isGenerating: false, hasResult: false,
    actionRunning: false, hasCnt: false, hasAud: false, needAudience: false,
    registerNodeRef: jest.fn(), supabase: {}, currentSite: null,
    textParams: {}, imageParams: {}, videoParams: {}, audioParams: {}, renderMediaWithZoom: jest.fn(),
    actions: { handleExecuteNode: execute, handleImprentaNodeHover: jest.fn(), isImprentaWorkflowActionNode: () => false },
  } as unknown as Omit<ImprentaNodeCardProps, "node" | "nodes" | "contexts" | "logs" | "hasRealChildren">
  function Canvas({ nodes }: { nodes: InstanceNode[] }) {
    const cardData = useImprentaCardData(nodes, empty, contexts, logs)
    return <TooltipProvider>{nodes.map(item =>
      <ImprentaNodeCardInner key={item.id} {...shared} {...cardData(item)} node={item} />
    )}</TooltipProvider>
  }
  const a = node("a")
  const b = node("b")
  const view = render(<Canvas nodes={[a, b]} />)
  mockEditor.mockClear()
  const edited = { ...a, prompt: { text: "Edited" } }
  view.rerender(<Canvas nodes={[edited, b]} />)
  expect(mockEditor.mock.calls.map(([props]) => props.node.id)).toEqual(["a"])
  fireEvent.click(screen.getByRole("button", { name: "Run a" }))
  expect(execute).toHaveBeenCalledWith(edited)

  mockEditor.mockClear()
  view.rerender(<Canvas nodes={[edited, b, node("child", "a")]} />)
  expect(mockEditor.mock.calls.map(([props]) => props.node.id)).toEqual(["a", "child"])
  expect(screen.getByTestId("a")).toHaveTextContent("locked")
  expect(screen.getByTestId("b")).toHaveTextContent("editable")
})

it("retains ancestor and incoming-context references but updates dependent cards", () => {
  const parent = node("parent")
  const child = node("child", parent.id)
  const other = node("other")
  const link = { id: "link", target_node_id: child.id, context_node_id: other.id }
  const initial = { nodes: [parent, child, other], contexts: [link], logs }
  const view = renderHook(props => useImprentaCardData(props.nodes, empty, props.contexts, props.logs), { initialProps: initial })
  const first = view.result.current(child)
  expect(first.nodes).toEqual([parent])
  view.rerender({ ...initial, nodes: [parent, child, { ...other }], contexts: [link, { ...link, id: "other-link", target_node_id: other.id }] })
  expect(view.result.current(child).nodes).toBe(first.nodes)
  expect(view.result.current(child).contexts).toBe(first.contexts)
  const nextParent = { ...parent, settings: { media_type: "image" } }
  view.rerender({ ...initial, nodes: [nextParent, child, other] })
  expect(view.result.current(child).nodes).toEqual([nextParent])
  expect(view.result.current(child).nodes).not.toBe(first.nodes)
})

it("routes late logs only to audience cards and handles cyclic ancestry", () => {
  const audience = { ...node("audience", "child"), type: "generate-audience" }
  const child = node("child", "audience")
  const image = { ...node("image"), type: "generate-image", result: { outputs: [{ type: "image", url: "https://example.test/image.png" }] } }
  const initial = { nodes: [audience, child, image], logs }
  const view = renderHook(props => useImprentaCardData(props.nodes, empty, contexts, props.logs), { initialProps: initial })
  const before = view.result.current(image)
  const nextLogs = [{ tool_name: "audience", tool_result: { audience_leads: [{ id: "lead" }] } }]
  view.rerender({ ...initial, logs: nextLogs })
  expect(view.result.current(child).nodes).toEqual([audience])
  expect(view.result.current(child).logs).toBe(nextLogs)
  expect(view.result.current(image).logs).toBe(before.logs)
})