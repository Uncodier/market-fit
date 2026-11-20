import { fireEvent, render, screen, within } from "@testing-library/react"
import { CategoryTemplateEditor } from "@/app/records/components/CategoryTemplateEditor"
import { deleteRecordCategory, type RecordCategory } from "@/app/records/actions"

jest.mock("@/app/records/actions", () => ({ deleteRecordCategory: jest.fn() }))
jest.mock("@/app/components/ui/emoji-picker", () => ({ EmojiPicker: () => null }))

const category: RecordCategory = {
  id: "collection",
  site_id: "site",
  name: "Feedback",
  description: null,
  icon: null,
  template_fields: [],
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
}

it("places deletion last in the editor body, outside the footer, and retains confirmation", () => {
  render(<CategoryTemplateEditor isOpen onClose={jest.fn()} category={category}
    onSave={jest.fn()} onDeleted={jest.fn()} />)

  const zone = screen.getByRole("region", { name: "Danger zone" })
  const remove = within(zone).getByRole("button", { name: "Delete collection" })
  const footer = screen.getByRole("button", { name: "Save Template" }).closest('[data-slot="dialog-footer"]')
  expect(footer).not.toContainElement(remove)
  expect(footer).toContainElement(screen.getByRole("button", { name: "Cancel" }))
  expect(zone.parentElement?.lastElementChild).toBe(zone)
  expect(zone.parentElement?.nextElementSibling).toBe(footer)

  fireEvent.click(remove)
  expect(screen.getByRole("dialog", { name: "Move collection to Trash?" })).toBeVisible()
  expect(deleteRecordCategory).not.toHaveBeenCalled()
})

it.each([null, category])("hides the danger zone when deletion is unavailable (%s)", existing => {
  render(<CategoryTemplateEditor isOpen onClose={jest.fn()} category={existing} onSave={jest.fn()} />)
  expect(screen.queryByRole("region", { name: "Danger zone" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Delete collection" })).not.toBeInTheDocument()
})