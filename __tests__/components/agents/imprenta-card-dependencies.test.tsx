import { fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/app/components/ui/tooltip"
import { ImprentaNodeCardInner } from "@/app/components/agents/imprenta-panel/node-card"
import { useImprentaCardData } from "@/app/components/agents/imprenta-panel/card-data"
import type { ImprentaNodeCardProps } from "@/app/components/agents/imprenta-panel/card-types"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { ImprentaContext } from "@/app/components/agents/imprenta-panel/data-types"

jest.mock("@/app/components/agents/imprenta-panel/markdown", () => ({ MemoMarkdown: () => null }))

it("updates inherited media geometry and real actions without global graph props", () => {
  const parent: InstanceNode = {
    id: "parent", parent_node_id: null, type: "generate-image", status: "completed",
    instance_id: "instance", site_id: "site", user_id: "user",
    original_node_id: null, parent_instance_log_id: null, created_at: "2026-11-17", updated_at: "2026-11-17",
    settings: { parameters: { aspectRatio: "9:16" } }, prompt: {}, result: {},
  }
  const child = {
    ...parent, id: "child", parent_node_id: parent.id, settings: { imprenta_mode: true },
    result: { outputs: [{ url: "https://example.test/image.png", type: "image" }] },
  }
  let currentNodes = [parent, child]
  const execute = jest.fn()
  const renderMedia = jest.fn((url: string, _type: string, key: React.Key) => <span key={key}>Media {url}</span>)
  const emptyNodes: InstanceNode[] = []
  const logs: ImprentaNodeCardProps["logs"] = []
  const shared = {
    pos: { x: 0, y: 0 }, hasResult: true, actionRunning: false, isDragging: false, isGenerating: false,
    hasCnt: false, hasAud: false, needAudience: false, registerNodeRef: jest.fn(),
    supabase: {}, currentSite: null, textParams: {}, imageParams: {}, videoParams: {}, audioParams: {},
    renderMediaWithZoom: renderMedia,
    actions: {
      isImprentaWorkflowActionNode: () => false, handleImprentaNodeHover: jest.fn(),
      getParentNode: (node: InstanceNode) => currentNodes.find(item => item.id === node.parent_node_id),
      handleExecuteNode: execute,
    },
  } as unknown as Omit<ImprentaNodeCardProps, "node" | "nodes" | "contexts" | "logs" | "hasRealChildren">
  function Canvas({ nodes, contexts }: { nodes: InstanceNode[]; contexts: ImprentaContext[] }) {
    const getData = useImprentaCardData(nodes, emptyNodes, contexts, logs)
    return <TooltipProvider><ImprentaNodeCardInner {...shared} {...getData(child)} node={child} /></TooltipProvider>
  }
  const view = render(<Canvas nodes={currentNodes} contexts={[]} />)
  expect(renderMedia).toHaveBeenLastCalledWith("https://example.test/image.png", "image", expect.anything(), "9/16", true)
  expect(screen.getByRole("button", { name: "Variant" })).toBeDisabled()
  const updatedParent = { ...parent, settings: { parameters: { aspectRatio: "16:9" } } }
  currentNodes = [updatedParent, child]
  view.rerender(<Canvas nodes={currentNodes} contexts={[{ id: "link", context_node_id: parent.id, target_node_id: child.id }]} />)
  expect(renderMedia).toHaveBeenLastCalledWith("https://example.test/image.png", "image", expect.anything(), "16/9", true)
  expect(screen.getByRole("button", { name: "Variant" })).toBeEnabled()
  fireEvent.click(screen.getByRole("button", { name: "Variant" }))
  expect(execute).toHaveBeenCalledWith(updatedParent)
})