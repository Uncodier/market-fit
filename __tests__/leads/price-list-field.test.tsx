import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LeadPriceListField } from "@/app/leads/components/LeadPriceListField"
import { getLeadPriceListOptions } from "@/app/leads/price-list-actions"

jest.mock("@/app/leads/price-list-actions", () => ({ getLeadPriceListOptions: jest.fn() }))
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }))

const onCommit = jest.fn<Promise<void>, [string | null]>()
const data = [
  { id: "retail", name: "Retail", currency: "USD", is_active: true },
  { id: "vip", name: "VIP", currency: "EUR", is_active: true },
  { id: "old", name: "Old", currency: "USD", is_active: false },
]

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getLeadPriceListOptions).mockResolvedValue({ data })
  onCommit.mockResolvedValue(undefined)
})

async function open(value: string | null = null) {
  const view = render(<LeadPriceListField siteId="site" value={value} showEmpty onCommit={onCommit} />)
  await act(async () => {})
  fireEvent.click(screen.getByText(value === "old" ? "Old (USD) — Inactive" : value ? "Retail (USD)" : "Not specified"))
  return view
}

it("selects an existing active price list and saves its ID", async () => {
  await open()
  fireEvent.change(screen.getByPlaceholderText("Select price list"), { target: { value: "VIP" } })
  fireEvent.keyDown(screen.getByPlaceholderText("Select price list"), { key: "Enter" })
  expect(onCommit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Save price list" }))
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith("vip"))
  expect(getLeadPriceListOptions).toHaveBeenCalledWith("site")
})

it("can clear a saved assignment", async () => {
  await open("retail")
  fireEvent.click(screen.getByRole("button", { name: "Clear price list" }))
  fireEvent.click(screen.getByRole("button", { name: "Save price list" }))
  await waitFor(() => expect(onCommit).toHaveBeenCalledWith(null))
})

it("labels inactive assignments but does not offer inactive lists or inline creation", async () => {
  await open("old")
  fireEvent.change(screen.getByPlaceholderText("Select price list"), { target: { value: "Old" } })
  expect(await screen.findByText("No active price lists found")).toBeInTheDocument()
  expect(screen.queryByText('Use "Old"')).not.toBeInTheDocument()
})

it("retains the draft after save failure", async () => {
  const error = jest.spyOn(console, "error").mockImplementation(() => {})
  try {
    onCommit.mockRejectedValueOnce(new Error("Denied"))
    await open("retail")
    fireEvent.click(screen.getByRole("button", { name: "Save price list" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Save price list" })).toBeEnabled())
    expect(screen.getByPlaceholderText("Select price list")).toHaveValue("Retail (USD)")
  } finally { error.mockRestore() }
})

it("shows read failures with retry rather than an empty successful picker", async () => {
  jest.mocked(getLeadPriceListOptions).mockResolvedValueOnce({ data: [], error: "Could not load price lists." })
  render(<LeadPriceListField siteId="site" value={null} showEmpty onCommit={onCommit} />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load price lists.")
  fireEvent.click(screen.getByText("Not specified"))
  expect(screen.queryByPlaceholderText("Select price list")).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  fireEvent.click(screen.getByText("Not specified"))
  expect(screen.getByPlaceholderText("Select price list")).toBeInTheDocument()
})

it("respects the contact-info empty-field toggle", async () => {
  const { rerender } = render(<LeadPriceListField siteId="site" value={null} showEmpty={false} onCommit={onCommit} />)
  await act(async () => {})
  expect(screen.queryByText("Price list")).not.toBeInTheDocument()
  rerender(<LeadPriceListField siteId="site" value={null} showEmpty onCommit={onCommit} />)
  expect(screen.getByText("Price list")).toBeInTheDocument()
})

it("ignores a stale site lookup after navigation", async () => {
  let resolve!: (value: { data: typeof data }) => void
  jest.mocked(getLeadPriceListOptions).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  const { rerender } = render(<LeadPriceListField siteId="first" value="retail" showEmpty onCommit={onCommit} />)
  rerender(<LeadPriceListField siteId="second" value="retail" showEmpty onCommit={onCommit} />)
  await screen.findByText("Retail (USD)")
  await act(async () => resolve({ data: [{ ...data[0], name: "Wrong site" }] }))
  expect(screen.getByText("Retail (USD)")).toBeInTheDocument()
  expect(screen.queryByText("Wrong site (USD)")).not.toBeInTheDocument()
})