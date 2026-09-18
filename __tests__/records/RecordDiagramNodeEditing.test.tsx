import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { RecordDiagramNodeCard } from "@/app/records/[id]/components/record-diagram/RecordDiagramNodeCard"
import { RecordNodeMarkdownControls } from "@/app/records/[id]/components/record-diagram/RecordNodeMarkdownControls"
import { useRecordNodeMarkdownEditor } from "@/app/records/[id]/components/record-diagram/use-record-node-markdown-editor"
import type { RecordDiagramNode } from "@/app/records/lib/record-diagram"

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => (
    children.startsWith("## ")
      ? <h2>{children.slice(3)}</h2>
      : <p>{children}</p>
  ),
}))
jest.mock("remark-gfm", () => ({ __esModule: true, default: jest.fn() }))

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

const nodeId = "00000000-0000-4000-8000-000000000001"

function node(kind: RecordDiagramNode["kind"]): RecordDiagramNode {
  return {
    id: nodeId,
    kind,
    title: kind === "title" ? "Section title" : "Description",
    content: kind === "title" ? "" : "Important signal",
    metadata: {},
    position: { x: 80, y: 80 },
  }
}

function NodeHarness({ initial }: { initial: RecordDiagramNode }) {
  const [current, setCurrent] = useState(initial)
  const markdown = useRecordNodeMarkdownEditor((id, content) => {
    if (id === current.id) setCurrent((value) => ({ ...value, content }))
  })
  return (
    <>
      {markdown.activeNodeId && <RecordNodeMarkdownControls onFormat={markdown.format} />}
      <RecordDiagramNodeCard
        node={current}
        selected={false}
        connecting={false}
        activeConnectionPort={null}
        onSelect={jest.fn()}
        onMouseDown={jest.fn()}
        onChange={(patch) => setCurrent((value) => ({ ...value, ...patch }))}
        onContentFocus={(element) => markdown.focus(current.id, element)}
        onContentBlur={markdown.blur}
        onDelete={jest.fn()}
        onConnector={jest.fn()}
      />
    </>
  )
}

describe("RecordDiagramNodeCard editing", () => {
  it("shows Markdown tools while editing content and formats selected text", () => {
    render(<NodeHarness initial={node("note")} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit node content" }))
    const content = screen.getByRole("textbox", { name: "Node content" }) as HTMLTextAreaElement
    expect(content.parentElement).toHaveClass("pt-0", "pb-10")

    fireEvent.focus(content)
    content.setSelectionRange(0, 9)
    fireEvent.click(screen.getByRole("button", { name: "Bold" }))

    expect(content).toHaveValue("**Important** signal")
  })

  it("does not let Markdown formatting exceed the stored content limit", () => {
    render(<NodeHarness initial={{ ...node("note"), content: "x".repeat(12_000) }} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit node content" }))
    const content = screen.getByRole("textbox", { name: "Node content" }) as HTMLTextAreaElement

    fireEvent.focus(content)
    content.setSelectionRange(0, 1)
    fireEvent.click(screen.getByRole("button", { name: "Bold" }))

    expect(content).toHaveValue("x".repeat(12_000))
  })

  it("renders title and description nodes with only their semantic field", () => {
    const titleView = render(<NodeHarness initial={node("title")} />)
    const title = screen.getByRole("textbox", { name: "Node title" })
    expect(title).toBeVisible()
    expect(title.parentElement).toHaveClass(
      "absolute",
      "inset-0",
      "justify-center",
      "overflow-visible",
    )
    expect(title).not.toHaveClass("absolute")
    expect(title).toHaveClass("-translate-y-4", "py-0", "leading-[2.25rem]")
    expect(title.parentElement).toHaveStyle({
      alignItems: "center",
      bottom: "0",
      flexDirection: "row",
      left: "0",
      position: "absolute",
      right: "0",
      top: "0",
    })
    expect(screen.queryByRole("textbox", { name: "Node content" })).not.toBeInTheDocument()

    titleView.unmount()
    render(<NodeHarness initial={node("description")} />)
    expect(screen.queryByRole("textbox", { name: "Node title" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit node content" }))
    expect(screen.getByRole("textbox", { name: "Node content" })).toHaveStyle({ minHeight: "20px" })
  })

  it("renders saved node content as Markdown outside edit mode", () => {
    render(<NodeHarness initial={{ ...node("note"), content: "## Important signal" }} />)

    expect(screen.getByRole("heading", { level: 2, name: "Important signal" })).toBeVisible()
    expect(screen.queryByText("## Important signal")).not.toBeInTheDocument()
  })

  it("applies border color and thickness from node options", () => {
    const { container } = render(<NodeHarness initial={node("note")} />)
    fireEvent.click(screen.getByRole("button", { name: "Options for Description" }))
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Border Rose" }))
    const thickOption = screen.getByRole("menuitemradio", { name: "Thick" })
    expect(thickOption.querySelector("span")).toHaveStyle({ height: "4px" })
    fireEvent.click(thickOption)

    const frame = container.querySelector('[data-node-kind="note"] > div')
    expect(frame).toHaveClass("bg-rose-500/45")
    expect(frame?.firstElementChild).toHaveClass("inset-1")
  })

  it("keeps connector geometry stable on hover", () => {
    render(<NodeHarness initial={node("note")} />)
    const connector = screen.getByRole("button", { name: "Connector right for Description" })

    expect(connector).toHaveClass("transition-colors")
    expect(connector).not.toHaveClass("hover:scale-125")
    expect(connector).not.toHaveClass("hover:ring-2")
    expect(connector).toHaveStyle({
      right: "-12px",
      top: "50%",
      transform: "translateY(-50%)",
    })
  })
})
