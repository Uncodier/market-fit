import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { Check, CheckCircle, CheckCircle2, Loader, Loader2 } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { SectionCardHeader } from "@/app/components/ui/section-card"
import { PdpCtaButton } from "@/app/components/commerce/pdp/PdpCtaButton"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"
import { ImageFullscreenViewer } from "@/app/components/simple-messages-view/components/ImageFullscreenViewer"
import { VideoFullscreenViewer } from "@/app/components/simple-messages-view/components/VideoFullscreenViewer"
import { SimpleAgentCard } from "@/app/components/agents/simple-agent-card"
import { GridAgentRow } from "@/app/components/agents/grid-agent-row"
import type { Agent } from "@/app/types/agents"

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => {
    React.useState(null)
    return { currentSite: null }
  },
}))
jest.mock("@/app/components/ui/use-toast", () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock("@/app/components/agents/agent-activity-list", () => ({ AgentActivityList: () => null }))
jest.mock("@/app/components/agents/agent-activity-item", () => ({ AgentActivityItem: () => null }))

describe("shared UI contract repairs", () => {
  it("forwards stroke width to SVG and preserves icon aliases and input styling", () => {
    const click = jest.fn()
    const { container } = render(<Input aria-label="Search" icon={<Check className="custom-icon" strokeWidth={2} onClick={click} />} />)
    const svg = container.querySelector("svg")!
    expect(svg).toHaveAttribute("stroke-width", "2")
    expect(svg.parentElement).toHaveClass("custom-icon", "h-4", "w-4")
    fireEvent.click(svg.parentElement!)
    expect(click).toHaveBeenCalledTimes(1)
    expect(Loader2).toBe(Loader)
    expect(CheckCircle).toBe(CheckCircle2)
  })

  it("renders rich section titles and a single actionable download link", () => {
    render(<><SectionCardHeader title={<strong>Overview</strong>} /><PdpCtaButton asChild><a href="/file.pdf" download>Download</a></PdpCtaButton></>)
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "/file.pdf")
    expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument()
  })

  it("keeps JSON hooks stable when data appears and disappears", () => {
    const { rerender } = render(<JsonHighlighter data={null} />)
    rerender(<JsonHighlighter data={{ answer: 42 }} />)
    expect(screen.getByText(/42/)).toBeInTheDocument()
    rerender(<JsonHighlighter data={undefined} />)
    expect(screen.getByText("No data available")).toBeInTheDocument()
  })

  it("keeps viewer hooks stable when media is loaded and cleared", () => {
    const close = jest.fn()
    const { rerender } = render(<><ImageFullscreenViewer isOpen={false} onClose={close} images={[]} /><VideoFullscreenViewer isOpen={false} onClose={close} videos={[]} /></>)
    rerender(<><ImageFullscreenViewer isOpen={false} onClose={close} images={["/image.png"]} /><VideoFullscreenViewer isOpen={false} onClose={close} videos={["/video.mp4"]} /></>)
    rerender(<><ImageFullscreenViewer isOpen={false} onClose={close} images={[]} /><VideoFullscreenViewer isOpen={false} onClose={close} videos={[]} /></>)
  })

  it("reads site context even when agents are temporarily hidden", () => {
    const agent: Agent & { isDisabled: boolean } = { id: "test", name: "Helper", description: "Support", type: "support", status: "inactive", conversations: 0, successRate: 0, lastActive: "2026-01-01", icon: "User", isDisabled: true }
    const action = jest.fn()
    const { rerender } = render(<><SimpleAgentCard agent={agent} /><table><tbody><GridAgentRow agent={agent} isExpanded={false} onToggleExpand={action} onManage={action} onChat={action} onExecuteActivity={action} /></tbody></table></>)
    rerender(<><SimpleAgentCard agent={{ ...agent, isDisabled: false }} /><table><tbody><GridAgentRow agent={{ ...agent, isDisabled: false }} isExpanded={false} onToggleExpand={action} onManage={action} onChat={action} onExecuteActivity={action} /></tbody></table></>)
    expect(screen.getAllByText("Helper").length).toBeGreaterThan(0)
  })
})