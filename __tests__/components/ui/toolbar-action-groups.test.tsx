import { readFileSync } from "fs"
import path from "path"
import * as ts from "typescript"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { ToolbarActionGroup, ToolbarActionGroups } from "@/app/components/ui/toolbar-action-groups"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import { Pencil, Printer, Send } from "@/app/components/ui/icons"

describe("contextual toolbar action groups", () => {
  it("groups related tools without individual separators and retains tooltips and handlers", async () => {
    const onPrint = jest.fn()
    render(<ToolbarActionGroups>
      <ToolbarActionGroup label="Editing"><ToolbarIconButton label="Edit"><Pencil /></ToolbarIconButton></ToolbarActionGroup>
      <ToolbarActionGroup label="Delivery">
        <ToolbarIconButton label="Print" onClick={onPrint}><Printer /></ToolbarIconButton>
        <ToolbarIconButton label="Send"><Send /></ToolbarIconButton>
      </ToolbarActionGroup>
    </ToolbarActionGroups>)
    const delivery = screen.getByRole("group", { name: "Delivery" })
    expect(within(delivery).getAllByRole("button")).toHaveLength(2)
    expect(within(delivery).queryByRole("separator")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Print" }))
    expect(onPrint).toHaveBeenCalledTimes(1)
    fireEvent.focus(screen.getByRole("button", { name: "Send" }))
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Send")
  })

  it("defines spacing only between nonempty groups, including conditional actions", () => {
    const css = readFileSync(path.join(process.cwd(), "app/components/ui/toolbar-action-groups.module.css"), "utf8")
    expect(css).toContain(':not(:has(button, a[href], [role="button"]))')
    expect(css).toContain('display: none')
    expect(css).toContain('~ [data-toolbar-action-group]:has(button, a[href], [role="button"])')
    expect(css).toContain('border-inline-start: 1px')
  })

  it.each([
    ["app/bills/[id]/page.tsx", "Bill delivery", ["handlePrint", "handleSend", "handleCopyVendorLink"]],
    ["app/bills/[id]/page.tsx", "Bill accounting", ["onPublish", "onUnpublish"]],
    ["app/quotations/[id]/page.tsx", "Quotation preparation", ["handleAuthorize"]],
    ["app/quotations/[id]/page.tsx", "Quotation delivery", ["handleSend", "handleCopyClientLink", "handlePrint"]],
    ["app/transactions/[id]/page.tsx", "Expense accounting", ["handlePublish", "handleUnpublish"]],
  ])("assigns %s actions to their contextual %s group", (file, label, handlers) => {
    const source = readFileSync(path.join(process.cwd(), file as string), "utf8")
    const ast = ts.createSourceFile(file as string, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const groups: ts.JsxElement[] = []
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "ToolbarActionGroup") groups.push(node)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    const group = groups.find(node => node.openingElement.getText(ast).includes(`label="${label}"`))
    expect(group).toBeDefined()
    for (const handler of handlers as string[]) expect(group!.getText(ast)).toContain(`onClick={${handler}}`)
    expect(groups.map(node => node.getText(ast)).join(" ")).not.toContain("w-px")
  })
})