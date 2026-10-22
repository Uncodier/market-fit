import { fireEvent, render, screen } from "@testing-library/react"
import { ImprentaUploadedFile } from "@/app/components/agents/imprenta-uploaded-file"
import type { InstanceNode } from "@/app/types/instance-nodes"

const node: InstanceNode = {
  id: "uploaded", instance_id: "instance-a", site_id: "site-a", user_id: "user-a",
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  type: "generate-text", status: "completed", created_at: "2026-10-22", updated_at: "2026-10-22",
  settings: { imprenta_source: "upload", media_type: "text" },
  prompt: { text: "Brief.pdf" },
  result: { outputs: [{ url: "https://example.test/brief.pdf", type: "text" }] },
}

it("keeps PDF/text uploads accessible instead of rendering an empty result", () => {
  const click = jest.fn()
  render(<div onClick={click}><ImprentaUploadedFile node={node} /></div>)
  const link = screen.getByRole("link", { name: "Brief.pdf" })
  expect(link).toHaveAttribute("href", "https://example.test/brief.pdf")
  expect(link).toHaveAttribute("rel", "noopener noreferrer")
  fireEvent.click(link)
  expect(click).not.toHaveBeenCalled()
})

it.each([
  { ...node, settings: { imprenta_source: "upload", media_type: "image" } },
  { ...node, settings: { media_type: "text" } },
  { ...node, result: { outputs: [{ url: "javascript:alert(1)", type: "text" }] } },
])("does not replace generated results or expose unsafe links", record => {
  render(<ImprentaUploadedFile node={record} />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
})