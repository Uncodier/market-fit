import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { toast } from "sonner"
import { EditCatalogCategoryDialog } from "@/app/catalog/components/EditCatalogCategoryDialog"
import { archiveCatalogCategory } from "@/app/catalog/category-actions"
import { upsertCatalogCategory } from "@/app/catalog/actions"
import type { CatalogCategory } from "@/app/types"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/catalog/category-actions", () => ({ archiveCatalogCategory: jest.fn() }))
jest.mock("@/app/catalog/actions", () => ({ upsertCatalogCategory: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }) }) }) }),
}))

const category: CatalogCategory = {
  id: "category", site_id: "site", name: "Seasonal products", status: "active",
  sort_order: 0, created_at: "2026-10-12", updated_at: "2026-10-12",
}

function setup(overrides: Partial<CatalogCategory> = {}) {
  const onOpenChange = jest.fn()
  const onSuccess = jest.fn()
  render(<EditCatalogCategoryDialog siteId="site" category={{ ...category, ...overrides }} open
    onOpenChange={onOpenChange} onSuccess={onSuccess} />)
  return { onOpenChange, onSuccess }
}

async function openConfirmation() {
  fireEvent.click(await screen.findByRole("button", { name: "Archive category" }))
  return screen.findByRole("alertdialog")
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(archiveCatalogCategory).mockResolvedValue({ success: true })
  jest.mocked(upsertCatalogCategory).mockResolvedValue({ data: category })
})

it("requires confirmation and lets the user cancel without changing data", async () => {
  const { onSuccess, onOpenChange } = setup()
  const confirmation = await openConfirmation()
  expect(confirmation).toHaveTextContent('"Seasonal products"')
  expect(confirmation).toHaveTextContent("all its items and variants, including those not currently visible")
  expect(archiveCatalogCategory).not.toHaveBeenCalled()
  fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(onSuccess).not.toHaveBeenCalled()
  expect(onOpenChange).not.toHaveBeenCalled()
})

it("archives the saved category without saving unrelated form edits, then refreshes", async () => {
  const { onSuccess, onOpenChange } = setup()
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Unsaved name" } })
  const confirmation = await openConfirmation()
  fireEvent.click(within(confirmation).getByRole("button", { name: "Archive category and items" }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  expect(archiveCatalogCategory).toHaveBeenCalledWith("site", "category")
  expect(upsertCatalogCategory).not.toHaveBeenCalled()
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(toast.success).toHaveBeenCalledWith("Category and all its items archived")
})

it("blocks duplicate requests and closing while archival is pending", async () => {
  let finish!: (value: { success: boolean }) => void
  jest.mocked(archiveCatalogCategory).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { onOpenChange } = setup()
  const confirmation = await openConfirmation()
  const confirm = within(confirmation).getByRole("button", { name: "Archive category and items" })
  fireEvent.click(confirm)
  expect(confirm).toBeDisabled()
  expect(within(confirmation).getByRole("button", { name: "Cancel" })).toBeDisabled()
  fireEvent.click(confirm)
  fireEvent.keyDown(confirmation, { key: "Escape" })
  expect(archiveCatalogCategory).toHaveBeenCalledTimes(1)
  expect(onOpenChange).not.toHaveBeenCalled()
  await act(async () => finish({ success: true }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it("keeps confirmation and form open on failure so the user can retry", async () => {
  jest.mocked(archiveCatalogCategory).mockResolvedValueOnce({ error: "Forbidden" })
  const { onSuccess, onOpenChange } = setup()
  const confirmation = await openConfirmation()
  fireEvent.click(within(confirmation).getByRole("button", { name: "Archive category and items" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Forbidden"))
  expect(onSuccess).not.toHaveBeenCalled()
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  await waitFor(() => expect(within(confirmation).getByRole("button", { name: "Archive category and items" })).toBeEnabled())
  fireEvent.click(within(confirmation).getByRole("button", { name: "Archive category and items" }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
})

it("does not offer to archive an already archived category", async () => {
  setup({ status: "archived" })
  expect(await screen.findByText("This category is archived.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Archive category" })).not.toBeInTheDocument()
})

it("preserves the existing save flow", async () => {
  const { onSuccess } = setup()
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed category" } })
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  expect(upsertCatalogCategory).toHaveBeenCalledWith(expect.objectContaining({ id: "category", name: "Renamed category" }))
  expect(archiveCatalogCategory).not.toHaveBeenCalled()
})