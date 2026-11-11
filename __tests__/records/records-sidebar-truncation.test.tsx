import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { RecordsSidebar } from "@/app/records/components/RecordsSidebar"
import { resolveRelationsForSidebar, type RecordCategory, type RecordItem } from "@/app/records/actions"

jest.mock("@/app/records/actions", () => ({ resolveRelationsForSidebar: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))

const category: RecordCategory = {
  id: "category", site_id: "site", name: "A very long category label that exceeds the sidebar width",
  description: null, icon: null, created_at: "2026-01-01", updated_at: "2026-01-01",
  template_fields: [{ name: "Members", type: "relation", relationTarget: "team_member" }],
}
const records: RecordItem[] = [{
  id: "record", site_id: "site", category_id: category.id, title: "Record",
  description: null, status: "draft", created_at: "2026-01-01", updated_at: "2026-01-01",
  data: {}, relations: { Members: "member" },
}]

it("constrains the scroll content and pills while retaining full labels and selection", async () => {
  const name = "A very long team member name that must not expand the selected pill"
  jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "team_member:member": name })
  const onSelectCategory = jest.fn()
  const { container } = render(<RecordsSidebar
    categories={[category]} records={records} selectedCategory={category.id}
    selectedRelation={{ fieldName: "Members", targetId: "member" }}
    onSelectCategory={onSelectCategory} isCollapsed={false}
  />)

  const label = await screen.findByText(name)
  for (const text of [label, screen.getByText(category.name), screen.getByText("Members")]) {
    expect(text).toHaveClass("min-w-0", "truncate", "flex-1")
    expect(text.closest("button")).toHaveClass("w-full", "min-w-0", "max-w-full", "rounded-full")
    expect(text.closest("button")).toHaveAttribute("title", text.textContent)
  }
  const viewport = container.querySelector("[data-radix-scroll-area-viewport]")
  expect(viewport?.parentElement).toHaveClass("[&_[data-radix-scroll-area-viewport]>div]:!block")
  fireEvent.click(label)
  expect(onSelectCategory).toHaveBeenCalledWith(category.id, { fieldName: "Members", targetId: "member" })
})