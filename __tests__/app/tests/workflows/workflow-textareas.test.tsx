import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorkflowStepBody } from "@/app/components/workflows/workflow-step-body"
import { WorkflowTriggerBody } from "@/app/components/workflows/workflow-trigger-body"

jest.mock("@/app/components/workflows/workflow-search-select", () => ({ WorkflowSearchSelect: () => null }))
jest.mock("@/app/components/workflows/workflow-cron-fields", () => ({ WorkflowCronFields: () => null }))
jest.mock("@/app/components/workflows/workflow-channel-message-fields", () => ({ WorkflowChannelMessageFields: () => null }))
jest.mock("@/app/components/ui/add-secret-dialog", () => ({ AddSecretDialog: () => null }))

const baseNode = {
  id: "node-1",
  instance_id: "instance-1",
  parent_node_id: null,
  original_node_id: null,
  parent_instance_log_id: null,
  type: "wf-step",
  status: "pending",
  result: {},
  site_id: "site-1",
  user_id: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  settings: { title: "Step", step: {} },
  prompt: { text: "A saved instruction" },
} satisfies InstanceNode

function setScrollHeight(textarea: HTMLTextAreaElement, height: number) {
  Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: height })
}

describe("workflow textareas", () => {
  it("links a visible account from Task beside Secrets without enabling a sandbox or granting use", async () => {
    const id = "00000000-0000-4000-8000-000000000101"
    const original = global.fetch
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{
      id, display_name: "Sales inbox", toolkit_slug: "gmail", can_use: false,
      provider_status: "ACTIVE", enabled: true, revocation_pending: false, verified_at: null, revision: 1,
    }] }) })
    try {
      const onChange = jest.fn().mockResolvedValue(undefined)
      const view = render(<WorkflowStepBody node={baseNode} onChange={onChange} />)
      expect(screen.getByText("Secrets")).toBeVisible()
      expect(global.fetch).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole("button", { name: "Select connector" }))
      fireEvent.change(await screen.findByLabelText("Task connector account"), { target: { value: id } })
      expect(onChange).toHaveBeenCalledWith(baseNode.id, { task_connector_id: id })
      await waitFor(() => expect(screen.queryByLabelText("Task connector account")).toBeNull())
      view.rerender(<WorkflowStepBody node={{ ...baseNode, task_connector_id: id }} onChange={onChange} />)
      expect(screen.getByText(/review scheduled authorization separately/i)).toBeVisible()
      fireEvent.click(screen.getByRole("button", { name: "Environment" }))
      expect(screen.queryByText("Connector")).toBeNull()
      expect(screen.queryByText("Secrets")).toBeNull()
    } finally { global.fetch = original }
  })
  it("expands a step's saved instructions and live input without internal scrolling", () => {
    const onChange = jest.fn().mockResolvedValue(undefined)
    const { unmount } = render(<WorkflowStepBody node={baseNode} onChange={onChange} />)
    const textarea = screen.getByPlaceholderText("Describe what this step should accomplish.") as HTMLTextAreaElement
    expect(textarea).toHaveValue("A saved instruction")
    expect(textarea).not.toHaveClass("max-h-[160px]")
    setScrollHeight(textarea, 280)
    fireEvent.input(textarea, { target: { value: "A long instruction" } })
    expect(textarea.style.height).toBe("280px")
    expect(textarea.style.overflowY).toBe("hidden")
    fireEvent.blur(textarea)
    expect(onChange).toHaveBeenCalledWith("node-1", expect.objectContaining({ prompt: { text: "A long instruction" } }))
    unmount()
  })

  it("grows the other step textareas as their tabs change", () => {
    const { unmount } = render(<WorkflowStepBody node={baseNode} onChange={jest.fn().mockResolvedValue(undefined)} />)
    for (const [tab, placeholder] of [
      ["Output", "Expected output"],
      ["Validation", "How this step is considered done (one per line)"],
      ["Environment", "If this step fails, try this instead of the original Task (used only on retry)."],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: tab }))
      const textarea = screen.getByPlaceholderText(placeholder) as HTMLTextAreaElement
      expect(textarea.className).not.toMatch(/max-h-/)
      setScrollHeight(textarea, 230)
      fireEvent.input(textarea, { target: { value: "Content with multiple lines" } })
      expect(textarea.style.height).toBe("230px")
    }
    unmount()
  })

  it("expands a trigger description and its sample message", () => {
    const { unmount } = render(
      <WorkflowTriggerBody
        node={baseNode}
        trigger={{ kind: "channel_message", description: "Saved description" }}
        enabled={false}
        hasExecutableStep
        onKindsChange={jest.fn()}
        onPersist={jest.fn().mockResolvedValue(undefined)}
      />,
    )
    const description = screen.getByPlaceholderText("Description...") as HTMLTextAreaElement
    expect(description).toHaveValue("Saved description")
    setScrollHeight(description, 245)
    fireEvent.input(description, { target: { value: "Long description" } })
    expect(description.style.height).toBe("245px")

    const sample = screen.getByLabelText("Sample customer message (test only)") as HTMLTextAreaElement
    setScrollHeight(sample, 310)
    fireEvent.input(sample, { target: { value: "Long sample" } })
    expect(sample.style.height).toBe("310px")
    unmount()
  })
})