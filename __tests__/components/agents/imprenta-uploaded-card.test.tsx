import { render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/app/components/ui/tooltip"
import { ImprentaNodeCardInner } from "@/app/components/agents/imprenta-panel/node-card"
import type { ImprentaNodeCardProps } from "@/app/components/agents/imprenta-panel/card-types"
import type { InstanceNode } from "@/app/types/instance-nodes"

jest.mock("@/app/components/agents/imprenta-panel/markdown", () => ({
  MemoMarkdown: ({ text }: { text: string }) => <span>{text}</span>,
}))

const node: InstanceNode = {
  id: "uploaded", instance_id: "instance-a", site_id: "site-a", user_id: "user-a",
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  type: "generate-image", status: "completed", prompt: { text: "Photo.png" },
  settings: { imprenta_source: "upload", media_type: "image" },
  result: { outputs: [{ url: "https://example.test/photo.png", type: "image" }] },
  created_at: "2026-10-22", updated_at: "2026-10-22",
}

function renderCard(record = node) {
  const renderMediaWithZoom = jest.fn((url: string, _type: string, key: React.Key) => <span key={key}>Media: {url}</span>)
  const props = {
    node: record, pos: { x: 100, y: 100 }, hasResult: true,
    actionRunning: false, hasCnt: false, hasAud: false, needAudience: false,
    draggingNodeId: null, registerNodeRef: jest.fn(), nodes: [record], dummyNodes: [],
    contexts: [], logs: [], supabase: {}, generatingNodeIds: new Set(), currentSite: null,
    textParams: {}, imageParams: {}, videoParams: {}, audioParams: {}, renderMediaWithZoom,
    actions: {
      getParentNode: jest.fn(), isImprentaWorkflowActionNode: () => true,
      handleImprentaNodeHover: jest.fn(),
    },
  } as unknown as ImprentaNodeCardProps
  render(<TooltipProvider><ImprentaNodeCardInner {...props} /></TooltipProvider>)
  return renderMediaWithZoom
}

it("renders the persisted image output as media, not an empty editable prompt", () => {
  const renderMedia = renderCard()
  expect(screen.getByText("Media: https://example.test/photo.png")).toBeInTheDocument()
  expect(renderMedia).toHaveBeenCalledWith("https://example.test/photo.png", "image", expect.anything(), expect.anything(), true)
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
})

it("renders a document output as an accessible saved file", () => {
  renderCard({
    ...node, type: "generate-text", prompt: { text: "Brief.pdf" },
    settings: { imprenta_source: "upload", media_type: "text" },
    result: { outputs: [{ url: "https://example.test/brief.pdf", type: "text" }] },
  })
  expect(screen.getByRole("link", { name: "Brief.pdf" })).toHaveAttribute("href", "https://example.test/brief.pdf")
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
})