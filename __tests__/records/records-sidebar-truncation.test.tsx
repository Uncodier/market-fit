import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { RecordsSidebar } from "@/app/records/components/RecordsSidebar"
import { resolveRelationsForSidebar, type RecordCategory, type RecordItem } from "@/app/records/actions"
import { SIDEBAR_ROW_HEIGHT } from "@/app/components/navigation/sidebar-metrics"

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/hooks/use-user-data", () => ({ useUserData: () => ({ userData: {} }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))

const category: RecordCategory = {
  id: "category", site_id: "site", name: "A very long category label that exceeds the sidebar width",
  description: null, icon: null, created_at: "2026-01-01", updated_at: "2026-01-01",
  template_fields: [{ id: "sales-field", name: "sales_man", label: "Sales representative", type: "relation", relationTarget: "team_member" }],
}
const records: RecordItem[] = [{
  id: "record", site_id: "site", category_id: category.id, title: "Record",
  description: null, status: "draft", created_at: "2026-01-01", updated_at: "2026-01-01",
  data: {}, relations: { sales_man: "member" },
}]

it("uses a subtle heading with the create action at the far right and a fixed footer", () => {
  const onCreateCategory = jest.fn()
  const onOpenTrash = jest.fn()
  const { container } = render(<RecordsSidebar
    categories={[]} records={[]} selectedCategory="all" selectedRelation={null}
    onSelectCategory={jest.fn()} isCollapsed={false}
    onCreateCategory={onCreateCategory} onOpenTrash={onOpenTrash}
  />)

  expect(container.firstElementChild).toHaveClass("h-full", "min-h-0", "flex-col")
  const heading = screen.getByRole("heading", { name: "Collections" })
  expect(heading).toHaveClass("text-[11px]", "text-muted-foreground")
  expect(heading.parentElement).not.toHaveClass("h-[71px]", "border-b")
  const create = screen.getByRole("button", { name: "New Category" })
  expect(create.parentElement).toBe(heading.parentElement)
  expect(create).toHaveClass("ml-auto", "shrink-0")
  fireEvent.click(create)
  expect(onCreateCategory).toHaveBeenCalledTimes(1)

  const viewport = container.querySelector("[data-radix-scroll-area-viewport]")
  expect(viewport?.parentElement).toHaveClass("flex-1", "min-h-0")
  const trash = screen.getByRole("button", { name: "Trash" })
  expect(trash.parentElement).toHaveClass("shrink-0", "p-4", "border-t", "dark:border-white/5", "border-black/5")
  expect(trash).toHaveStyle({ height: `${SIDEBAR_ROW_HEIGHT}px` })
  expect(trash).toHaveClass("py-0")
  fireEvent.click(trash)
  expect(onOpenTrash).toHaveBeenCalledTimes(1)
})

it("constrains the scroll content and pills while retaining full labels and selection", async () => {
  const name = "A very long team member name that must not expand the selected pill"
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "team_member:member": name })
  const onSelectCategory = jest.fn()
  const { container } = render(<RecordsSidebar
    categories={[category]} records={records} selectedCategory={category.id}
    selectedRelation={{ fieldName: "sales_man", targetId: "member" }}
    onSelectCategory={onSelectCategory} isCollapsed={false}
  />)

  const label = await screen.findByText(name)
  expect(screen.queryByText("sales_man")).not.toBeInTheDocument()
  for (const text of [label, screen.getByText(category.name), screen.getByText("Sales representative")]) {
    expect(text).toHaveClass("min-w-0", "truncate", "flex-1")
    expect(text.closest("button")).toHaveClass("w-full", "min-w-0", "max-w-full", "rounded-full")
    expect(text.closest("button")).toHaveAttribute("title", text.textContent)
  }
  const viewport = container.querySelector("[data-radix-scroll-area-viewport]")
  expect(viewport?.parentElement).toHaveClass("[&_[data-radix-scroll-area-viewport]>div]:!block")
  fireEvent.click(label)
  expect(onSelectCategory).toHaveBeenCalledWith(category.id, { fieldName: "sales_man", targetId: "member" })
  expect(label.closest("button")).toHaveAttribute("aria-pressed", "true")
  expect(label.closest("button")).toHaveAttribute("aria-description", "1 record")
  fireEvent.click(screen.getByRole("button", { name: "Clear member filter" }))
  expect(onSelectCategory).toHaveBeenLastCalledWith(category.id, null)
})

it("keeps both disclosures operable without selecting a row and supports fields without labels", async () => {
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "team_member:member": "Team Member" })
  const onSelectCategory = jest.fn()
  const unlabeled = { ...category, template_fields: [{ ...category.template_fields[0], label: undefined }] }
  render(<RecordsSidebar
    categories={[unlabeled]} records={records} selectedCategory="all" selectedRelation={null}
    onSelectCategory={onSelectCategory} isCollapsed={false}
  />)

  const collectionToggle = screen.getByRole("button", { name: `Toggle relations for ${category.name}`, expanded: false })
  expect(collectionToggle).toHaveClass("[@media(hover:hover)]:opacity-0", "group-hover:opacity-100", "focus-visible:opacity-100")
  fireEvent.click(collectionToggle)
  expect(collectionToggle).toHaveAttribute("aria-expanded", "true")

  const relationToggle = await screen.findByRole("button", { name: "sales_man", expanded: false })
  expect(relationToggle.lastElementChild).toHaveClass(
    "[@media(hover:hover)]:opacity-0", "group-hover:opacity-100", "group-focus-visible:opacity-100",
  )
  fireEvent.click(relationToggle)
  expect(relationToggle).toHaveAttribute("aria-expanded", "true")
  expect(screen.getByRole("button", { name: "Team Member" })).toBeInTheDocument()
  fireEvent.click(collectionToggle)
  expect(collectionToggle).toHaveAttribute("aria-expanded", "false")
  expect(relationToggle).not.toBeInTheDocument()
  expect(onSelectCategory).not.toHaveBeenCalled()
})

it("opens the active category's member filter and searches names without changing the filter", async () => {
  const names = ["Zara", "Bianca", "Chandra", "Dara", "Erin", "Alex"]
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue(Object.fromEntries(names.map((name, i) => [`team_member:${i}`, name])))
  const onSelectCategory = jest.fn()
  render(<RecordsSidebar categories={[category]} records={names.map((_, i) => ({ ...records[0], id: String(i), relations: { sales_man: String(i) } }))}
    selectedCategory={category.id} selectedRelation={null} onSelectCategory={onSelectCategory} isCollapsed={false} />)
  const search = await screen.findByRole("textbox", { name: "Search Sales representative" })
  fireEvent.change(search, { target: { value: "bianc" } })
  expect(screen.queryByRole("button", { name: "Alex" })).not.toBeInTheDocument()
  expect(onSelectCategory).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Bianca" }))
  expect(onSelectCategory).toHaveBeenCalledWith(category.id, { fieldName: "sales_man", targetId: "1" })
})