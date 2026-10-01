import { fireEvent, render, screen } from "@testing-library/react"
import { LeadsBulkActions } from "@/app/leads/components/LeadsBulkActions"

function renderActions(isLoading = false) {
  const handlers = {
    onCancel: jest.fn(),
    onAssign: jest.fn(),
    onStatusChange: jest.fn(),
    onDelete: jest.fn(),
  }

  render(<LeadsBulkActions isLoading={isLoading} {...handlers} />)
  return handlers
}

describe("LeadsBulkActions", () => {
  it("shows the bulk actions without a selected-count chip", () => {
    renderActions()

    expect(screen.getByText("Choose bulk action")).toBeInTheDocument()
    expect(screen.queryByText(/\bselected\b/i)).not.toBeInTheDocument()
    for (const name of ["Cancel", "Assign to me", "Change Status", "Delete"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled()
    }
  })

  it.each([
    ["Cancel", "onCancel"],
    ["Assign to me", "onAssign"],
    ["Delete", "onDelete"],
  ] as const)("preserves the %s action", (name, handler) => {
    const handlers = renderActions()

    fireEvent.click(screen.getByRole("button", { name }))

    expect(handlers[handler]).toHaveBeenCalledTimes(1)
  })

  it.each(["new", "contacted", "qualified", "cold", "converted", "lost", "not_qualified"])(
    "preserves the %s status action",
    status => {
      const handlers = renderActions()
      fireEvent.keyDown(screen.getByRole("button", { name: "Change Status" }), {
        key: "Enter",
        code: "Enter",
      })

      fireEvent.click(screen.getByRole("menuitem", { name: status.replace('_', ' ') }))

      expect(handlers.onStatusChange).toHaveBeenCalledTimes(1)
      expect(handlers.onStatusChange).toHaveBeenCalledWith(status)
    },
  )

  it("disables all actions while a bulk action is running", () => {
    const handlers = renderActions(true)

    for (const name of ["Cancel", "Assign to me", "Change Status", "Delete"]) {
      const button = screen.getByRole("button", { name })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    for (const handler of Object.values(handlers)) {
      expect(handler).not.toHaveBeenCalled()
    }
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
  })
})