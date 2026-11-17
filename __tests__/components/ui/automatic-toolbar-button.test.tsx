import * as React from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { Button } from "@/app/components/ui/button"
import { Loader, Pencil, SaveIcon } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { notifyPermissionDenied } from "@/lib/permissions/notify"
import { extractToolbarIcons, toolbarActionChildren } from "@/app/components/ui/automatic-toolbar-presentation"

jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn(() => null) }))
jest.mock("@/lib/permissions/notify", () => ({ notifyPermissionDenied: jest.fn() }))

const scope = (children: React.ReactNode) => <div data-toolbar-icon-actions="">{children}</div>

describe("automatic shared toolbar Button", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useOptionalPermissions).mockReturnValue(null)
  })

  it.each(["default", "ghost"] as const)("presents native %s actions without changing handlers, tint or glass", variant => {
    const onClick = jest.fn()
    const onFocus = jest.fn()
    render(scope(<Button variant={variant} tint="destructive" onClick={onClick} onFocus={onFocus}>
      <><span><Pencil className="mr-2 sm:ml-3 animate-pulse" style={{ marginRight: 8, color: "red" }} /></span><span>Edit record</span></>
    </Button>))
    const button = screen.getByRole("button", { name: "Edit record" })
    expect(button).toHaveClass("h-10", "w-10", "!p-0")
    expect(button).not.toHaveTextContent("Edit record")
    const icon = button.querySelector(".safari-icon-fix")!
    expect(icon).toHaveClass("animate-pulse")
    expect(icon).not.toHaveClass("mr-2", "sm:ml-3")
    expect(icon).toHaveStyle({ color: "red" })
    expect((icon as HTMLElement).style.marginRight).toBe("")
    if (variant === "default") {
      expect(button).toHaveClass("btn-primary", "btn-primary-circular")
      expect(button.parentElement).toHaveClass("btn-primary-well", "btn-tint-red")
      expect(button.querySelector(".btn-glass-surface")).toBeInTheDocument()
    } else expect(button.querySelector(".btn-glass-surface")).toBeNull()
    fireEvent.click(button)
    fireEvent.focus(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it.each(["default", "ghost"] as const)("preserves %s asChild link hosts, attributes and refs across discovery", variant => {
    const ref = jest.fn()
    const onClick = jest.fn((event: React.MouseEvent) => event.preventDefault())
    const view = render(scope(<Button asChild variant={variant} ref={ref}>
      <Link href="/records" data-link="kept" onClick={onClick}><Pencil />Edit record</Link>
    </Button>))
    const link = screen.getByRole("link", { name: "Edit record" })
    expect(link).toHaveAttribute("href", "/records")
    expect(link).toHaveAttribute("data-link", "kept")
    expect(link).not.toHaveTextContent("Edit record")
    expect(link.querySelector("svg")).toBeInTheDocument()
    // Discovery can mount the tooltip; the final ref must remain the actual
    // link rather than its presentation/tooltip wrapper.
    expect(ref).toHaveBeenLastCalledWith(link)
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(ref).toHaveBeenLastCalledWith(null)
  })

  it("exposes hover and focus Radix tooltips for already icon-only named actions", async () => {
    render(scope(<><Button variant="ghost" aria-label="Edit"><Pencil /></Button><Button variant="ghost" title="Save"><SaveIcon /></Button></>))
    const edit = screen.getByRole("button", { name: "Edit" })
    fireEvent.pointerMove(edit.parentElement!, { pointerType: "mouse" })
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Edit")
    fireEvent.keyDown(edit, { key: "Escape" })
    fireEvent.focus(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Save")
  })

  it("makes disabled action tooltips keyboard accessible without enabling the button", async () => {
    const onClick = jest.fn()
    render(scope(<Button disabled onClick={onClick}>Download report</Button>))
    const button = screen.getByRole("button", { name: "Download report" })
    expect(button).toBeDisabled()
    const trigger = button.closest("[data-automatic-toolbar-tooltip]")!
    expect(trigger).toHaveAttribute("tabindex", "0")
    fireEvent.focus(trigger)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Download report")
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(["tab", "tablist", "combobox", "menu", "menuitem", "listbox", "option", "dialog", "alertdialog"])("does not transform %s content", role => {
    render(scope(<div role={role}><Button variant="ghost"><Pencil />Original text</Button></div>))
    const button = screen.getByRole("button", { name: "Original text" })
    expect(button).toHaveTextContent("Original text")
    expect(button).not.toHaveClass("w-10")
  })

  it("checks the actual host role including asChild", () => {
    render(scope(<Button asChild variant="ghost"><a role="tab" href="#tab"><Pencil />Tab name</a></Button>))
    expect(screen.getByRole("tab")).toHaveTextContent("Tab name")
  })

  it("does not cross portals and leaves unscoped, opted-out and unnamed actions unchanged", () => {
    render(<>
      <Button>Outside</Button>
      {scope(<>
        {createPortal(<Button>Portal action</Button>, document.body)}
        <div data-toolbar-icon-actions="off"><Button>Scope off</Button></div>
        <Button data-toolbar-icon-action="off">Action off</Button>
        <Button variant="ghost" data-testid="unnamed"><Pencil /></Button>
      </>)}
    </>)
    for (const name of ["Outside", "Portal action", "Scope off", "Action off"]) {
      expect(screen.getByRole("button", { name })).toHaveTextContent(name)
      expect(screen.getByRole("button", { name })).not.toHaveClass("w-10")
    }
    expect(screen.getByTestId("unnamed")).not.toHaveAttribute("aria-label")
  })

  it("uses the nearest off/on scope and responds to scope changes without replacing refs", () => {
    const ref = React.createRef<HTMLButtonElement>()
    const view = render(<div data-toolbar-icon-actions="off">{scope(<Button ref={ref}>Save changes</Button>)}</div>)
    expect(ref.current!).not.toHaveTextContent("Save changes")
    view.rerender(<div data-toolbar-icon-actions="off"><div data-toolbar-icon-actions="off"><Button ref={ref}>Save changes</Button></div></div>)
    expect(ref.current).toBe(screen.getByRole("button", { name: "Save changes" }))
    expect(ref.current).toHaveTextContent("Save changes")
  })

  it("does not create a second tooltip for an existing Radix host trigger", async () => {
    render(scope(<TooltipProvider delayDuration={0}><Tooltip><TooltipTrigger asChild>
      <Button variant="ghost"><Pencil />Edit</Button>
    </TooltipTrigger><TooltipContent>Existing hint</TooltipContent></Tooltip></TooltipProvider>))
    fireEvent.focus(screen.getByRole("button", { name: "Edit" }))
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Existing hint")
    expect(screen.getAllByRole("tooltip")).toHaveLength(1)
  })

  it("allows tooltip presentation on popup triggers without overwriting their state", async () => {
    render(scope(<Button variant="ghost" aria-haspopup="dialog" data-state="closed">Open editor</Button>))
    const button = screen.getByRole("button", { name: "Open editor" })
    expect(button).toHaveAttribute("data-state", "closed")
    fireEvent.focus(button)
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Open editor")
    expect(button).toHaveAttribute("data-state", "closed")
  })

  it("keeps inferred update permissions from original text instead of the icon presentation", () => {
    const can = jest.fn(() => false)
    jest.mocked(useOptionalPermissions).mockReturnValue({ can } as unknown as NonNullable<ReturnType<typeof useOptionalPermissions>>)
    const onClick = jest.fn()
    render(scope(<Button onClick={onClick}>Save changes</Button>))
    const button = screen.getByRole("button", { name: "Save changes" })
    expect(can).toHaveBeenCalledWith("update")
    expect(button).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
    expect(notifyPermissionDenied).toHaveBeenCalledWith("update")
  })

  it("retains ghost permission exemptions and destructive tint inference", () => {
    const can = jest.fn(() => false)
    jest.mocked(useOptionalPermissions).mockReturnValue({ can } as unknown as NonNullable<ReturnType<typeof useOptionalPermissions>>)
    render(scope(<><Button variant="ghost">Save draft</Button><Button variant="outline" tint="destructive">Archive</Button></>))
    expect(screen.getByRole("button", { name: "Save draft" })).not.toHaveAttribute("aria-disabled")
    expect(can).toHaveBeenCalledWith("delete")
    expect(screen.getByRole("button", { name: "Archive" })).toHaveAttribute("aria-disabled", "true")
  })

  it("retains dynamic loading icons and selects meaningful then generic existing fallback icons", () => {
    const view = render(scope(<Button><Pencil />Edit</Button>))
    view.rerender(scope(<Button><Loader className="mr-2" />Saving</Button>))
    expect(screen.getByRole("button", { name: "Saving" }).querySelector(".animate-spin")).toBeInTheDocument()
    expect(extractToolbarIcons(<><span><Pencil /></span><SaveIcon /></>)).toHaveLength(2)
    expect((toolbarActionChildren("Save", "Save", false) as React.ReactElement).type).toBe(SaveIcon)
    expect(React.isValidElement(toolbarActionChildren("Unusual action", "Unusual action", false))).toBe(true)
  })

  it("preserves a filter-count adornment alongside the icon-only action", () => {
    render(scope(<Button variant="ghost" aria-label="Clear (3)"
      adornment={<span data-testid="filter-count">3</span>}>
      <Pencil />Clear
    </Button>))
    const button = screen.getByRole("button", { name: "Clear (3)" })
    expect(button.querySelector("svg")).toBeInTheDocument()
    expect(button).not.toHaveTextContent("Clear")
    expect(screen.getByTestId("filter-count")).toBeVisible()
    expect(button).toContainElement(screen.getByTestId("filter-count"))
  })

  it("settles under strict mode without a DOM-detection render loop", async () => {
    await act(async () => {
      render(<React.StrictMode>{scope(<Button>New record</Button>)}</React.StrictMode>)
    })
    expect(screen.getByRole("button", { name: "New record" })).toHaveClass("w-10")
  })

  it("keeps toolbar margin/visibility placement on its outer flex child", () => {
    render(scope(<Button className="ml-auto md:hidden">Save changes</Button>))
    const button = screen.getByRole("button", { name: "Save changes" })
    expect(button.closest("[data-automatic-toolbar-tooltip]")).toHaveClass("ml-auto", "md:hidden")
    expect(button).not.toHaveClass("ml-auto", "md:hidden")
  })
})