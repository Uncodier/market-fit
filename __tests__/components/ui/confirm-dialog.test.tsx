import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"

describe("ConfirmDialog", () => {
  it("waits for async confirm and stays open until it finishes", async () => {
    let resolveConfirm: () => void = () => {}
    const onConfirm = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve
        })
    )
    const onOpenChange = jest.fn()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete item"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: /Delete/ })).toBeDisabled()

    resolveConfirm()
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
