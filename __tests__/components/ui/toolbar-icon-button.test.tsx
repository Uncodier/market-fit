import { fireEvent, render, screen } from "@testing-library/react"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Pencil } from "@/app/components/ui/icons"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/app/components/ui/alert-dialog"

describe("ToolbarIconButton", () => {
  it("renders an accessible icon-only action and preserves clicks", () => {
    const onClick = jest.fn()
    render(<ToolbarIconButton label="Edit" onClick={onClick}><Pencil /></ToolbarIconButton>)
    const button = screen.getByRole("button", { name: "Edit" })
    expect(button).toHaveClass("h-10", "w-10")
    expect(button.querySelector("svg")).toBeInTheDocument()
    expect(screen.getByText("Edit")).toHaveClass("sr-only")
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("shows the action tooltip on hover", async () => {
    render(<ToolbarIconButton label="Print"><Pencil /></ToolbarIconButton>)
    fireEvent.pointerMove(screen.getByRole("button", { name: "Print" }).parentElement!, { pointerType: "mouse" })
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Print")
  })

  it("keeps disabled actions inactive and exposes their tooltip on focus", async () => {
    const onClick = jest.fn()
    render(<ToolbarIconButton label="Edit" disabled onClick={onClick}><Pencil /></ToolbarIconButton>)
    const button = screen.getByRole("button", { name: "Edit" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.focus(button.parentElement!)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Edit")
  })

  it("supports dialog triggers without bypassing confirmation", async () => {
    render(<AlertDialog>
      <AlertDialogTrigger asChild><ToolbarIconButton label="Delete"><Pencil /></ToolbarIconButton></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogTitle>Delete this bill?</AlertDialogTitle><AlertDialogDescription>This removes the bill.</AlertDialogDescription></AlertDialogContent>
    </AlertDialog>)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })
})