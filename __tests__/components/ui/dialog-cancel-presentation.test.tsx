import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import postcss from "postcss"
import tailwindcss from "tailwindcss"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/app/components/ui/dialog"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"

jest.mock("@/app/components/ui/use-btn-glass-motion", () => ({ useBtnGlassMotion: () => jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))

const mobileCancelClass = "max-sm:[&_[data-dialog-cancel=true]]:!hidden"

function Editor({ showClose = true, onClose = jest.fn() }) {
  return <Dialog open onOpenChange={onClose}>
    <DialogContent showClose={showClose} closeLabel="Close editor">
      <DialogTitle>Editor</DialogTitle>
      <DialogDescription>Edit document</DialogDescription>
      <DialogBody><Button variant="outline">Cancel subscription</Button></DialogBody>
      <DialogFooter data-testid="footer">
        <div><Button variant="outline" onClick={() => onClose(false)}>Cancel</Button></div>
        <Button>Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

test("scopes mobile cancellation hiding to footers with an alternative close control", () => {
  const onClose = jest.fn()
  const { rerender } = render(<Editor onClose={onClose} />)
  expect(screen.getByTestId("footer")).toHaveClass(mobileCancelClass)
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("data-dialog-cancel", "true")
  expect(screen.getByRole("button", { name: "Save" })).not.toHaveAttribute("data-dialog-cancel")
  expect(screen.getByRole("button", { name: "Cancel subscription" })).not.toHaveAttribute("data-dialog-cancel")
  fireEvent.click(screen.getByRole("button", { name: "Close editor" }))
  expect(onClose).toHaveBeenCalledWith(false)
  rerender(<Editor showClose={false} />)
  expect(screen.getByTestId("footer")).not.toHaveClass(mobileCancelClass)
})

test.each(["Cancel", "Cancelar", "Annuler", "Abbrechen", "キャンセル"])("recognizes %s including nested labels and primary wrappers", label => {
  render(<Button><span>{label}</span></Button>)
  const button = screen.getByRole("button", { name: label })
  expect(button).toHaveAttribute("data-dialog-cancel", "true")
  expect(button.parentElement).toHaveAttribute("data-dialog-cancel", "true")
  expect(button).not.toHaveClass("hidden")
})

test("preserves slotted buttons and their handlers", () => {
  const onClick = jest.fn()
  render(<Button asChild variant="outline"><button onClick={onClick}>Cancel</button></Button>)
  const button = screen.getByRole("button", { name: "Cancel" })
  expect(button).toHaveAttribute("data-dialog-cancel", "true")
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)
})

test("keeps alert confirmation cancellation available", () => {
  const onClose = jest.fn()
  render(<ConfirmDialog open onOpenChange={onClose} title="Delete document" description="This cannot be undone." onConfirm={jest.fn()} />)
  const cancel = screen.getByRole("button", { name: "Cancel" })
  expect(cancel).not.toHaveAttribute("data-dialog-cancel")
  fireEvent.click(cancel)
  expect(onClose).toHaveBeenCalledWith(false)
})

test("compiles the hide rule only below the modal sm breakpoint", async () => {
  const result = await postcss([tailwindcss({
    content: [{ raw: mobileCancelClass }],
    theme: { screens: { sm: "640px" } },
    corePlugins: { preflight: false },
  })]).process("@tailwind utilities;", { from: undefined })
  let rules = 0
  result.root.walkRules(rule => {
    rules += 1
    expect(rule.selector).toContain("[data-dialog-cancel=true]")
    expect(rule.parent).toMatchObject({ type: "atrule", name: "media", params: "not all and (min-width: 640px)" })
    expect(rule.nodes[0]).toMatchObject({ prop: "display", value: "none", important: true })
  })
  expect(rules).toBe(1)
})