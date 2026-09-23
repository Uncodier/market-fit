import { fireEvent, render, screen } from "@testing-library/react"
import { WorkflowStepToolsList } from "@/app/components/workflows/workflow-step-tools-list"
import type { McpCatalogTool } from "@/app/components/workflows/types"

const webSearch: McpCatalogTool = {
  name: "webSearch",
  label: "Web Search",
  actions: [],
}

describe("WorkflowStepToolsList", () => {
  it("shows catalog failures and lets the user retry", () => {
    const onRetry = jest.fn()

    render(
      <WorkflowStepToolsList
        actions={[]}
        catalog={[]}
        error="Unauthorized"
        onRetry={onRetry}
        onChange={jest.fn()}
      />,
    )

    expect(
      screen.getByText("Could not load tools: Unauthorized"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("shows the human tool label without a fake call action", () => {
    render(
      <WorkflowStepToolsList
        actions={[{ tool: "webSearch" }]}
        catalog={[webSearch]}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByDisplayValue("Web Search")).toBeInTheDocument()
    expect(screen.queryByDisplayValue("webSearch")).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText("All actions")).not.toBeInTheDocument()
  })

  it("shows only real actions", () => {
    render(
      <WorkflowStepToolsList
        actions={[{ tool: "leads", action: "create" }]}
        catalog={[
          {
            name: "leads",
            label: "Leads",
            actions: ["create", "list"],
          },
        ]}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByDisplayValue("Create")).toBeInTheDocument()
  })

  it("defaults tools with actions to All actions", () => {
    render(
      <WorkflowStepToolsList
        actions={[{ tool: "leads" }]}
        catalog={[{ name: "leads", label: "Leads", actions: ["create", "list"] }]}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByPlaceholderText("All actions")).toBeInTheDocument()
  })
})
