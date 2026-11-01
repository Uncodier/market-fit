import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DealHeaderActions } from "@/app/deals/components/DealHeaderActions"
import { deleteDeal } from "@/app/deals/actions"

let mockCanDelete = true
const mockReplace = jest.fn()
jest.mock("@/app/deals/actions", () => ({ deleteDeal: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/context/PermissionContext", () => ({
  useOptionalPermissions: () => ({ can: () => mockCanDelete }),
}))
jest.mock("@/app/components/ui/icons", () => ({ MoreHorizontal: () => null, Trash2: () => null }))

const deal = { id: "a2fb44cc-bf79-4994-a0a5-bc517f990bc1", name: "Example deal" }

beforeEach(() => {
  jest.clearAllMocks()
  mockCanDelete = true
  jest.mocked(useRouter).mockReturnValue({ replace: mockReplace } as unknown as ReturnType<typeof useRouter>)
  jest.mocked(deleteDeal).mockResolvedValue({ error: null })
})

async function openMenu() {
  fireEvent.keyDown(screen.getByRole("button", { name: "Deal options" }), { key: "ArrowDown" })
  return screen.findByRole("menuitem", { name: "Delete" })
}

async function openConfirmation() {
  render(<DealHeaderActions deal={deal} />)
  fireEvent.click(await openMenu())
  return screen.findByRole("alertdialog")
}

it("requires confirmation and lets the user cancel without deleting", async () => {
  const dialog = await openConfirmation()
  expect(dialog).toHaveTextContent(deal.name)
  expect(deleteDeal).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(deleteDeal).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

it("deletes the deal and returns to the list only after success", async () => {
  const dialog = await openConfirmation()
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/deals"))
  expect(deleteDeal).toHaveBeenCalledTimes(1)
  expect(deleteDeal).toHaveBeenCalledWith(deal.id)
  expect(toast.success).toHaveBeenCalledWith("Deal deleted")
})

it.each(["returned error", "exception"])("keeps confirmation open for retry on %s", async (failure) => {
  if (failure === "exception") jest.mocked(deleteDeal).mockRejectedValueOnce(new Error("Network failed"))
  else jest.mocked(deleteDeal).mockResolvedValueOnce({ error: "Deletion denied" })
  const dialog = await openConfirmation()
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(screen.getByRole("alertdialog")).toBeVisible()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/deals"))
})

it("blocks duplicate clicks and cancellation while deletion is pending", async () => {
  let resolve!: (value: { error: null }) => void
  jest.mocked(deleteDeal).mockReturnValueOnce(new Promise(accept => { resolve = accept }))
  const dialog = await openConfirmation()
  const confirm = within(dialog).getByRole("button", { name: "Delete" })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(confirm).toBeDisabled()
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled()
  fireEvent.keyDown(dialog, { key: "Escape" })
  expect(screen.getByRole("alertdialog")).toBeVisible()
  expect(deleteDeal).toHaveBeenCalledTimes(1)
  expect(mockReplace).not.toHaveBeenCalled()
  await act(async () => resolve({ error: null }))
  expect(mockReplace).toHaveBeenCalledWith("/deals")
})

it("disables Delete when the current role cannot delete", async () => {
  mockCanDelete = false
  render(<DealHeaderActions deal={deal} />)
  const item = await openMenu()
  expect(item).toHaveAttribute("aria-disabled", "true")
  fireEvent.click(item)
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(deleteDeal).not.toHaveBeenCalled()
})