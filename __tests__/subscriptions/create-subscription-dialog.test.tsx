import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { CreateSubscriptionDialog } from "@/app/subscriptions/components/CreateSubscriptionDialog"
import { listCatalogItems } from "@/app/catalog/actions"
import type { CatalogItem } from "@/app/types"

let currentSite: { id: string } | null = { id: "site-1" }

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/leads/actions", () => ({ getLeads: jest.fn(async () => ({ leads: [] })) }))
jest.mock("@/app/subscriptions/actions", () => ({ upsertSubscription: jest.fn() }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("@/app/commerce/resolve-buyer-lead", () => ({ findOrCreateLeadForBuyer: jest.fn() }))
jest.mock("@/app/components/commerce/BuyerUserEmailField", () => ({ BuyerUserEmailField: () => null }))
jest.mock("@/app/components/ui/date-picker", () => ({ DatePicker: () => null }))
jest.mock("@/app/components/finance/DueDateField", () => ({ DueDateField: () => null }))

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })

async function openCatalog() {
  fireEvent.click(await screen.findByPlaceholderText("Select a recurring plan..."))
}

const props = { open: true, onOpenChange: jest.fn(), onSuccess: jest.fn() }

function dialog(open = true) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <CreateSubscriptionDialog {...props} open={open} />
  </SWRConfig>
}

beforeEach(() => {
  jest.clearAllMocks()
  currentSite = { id: "site-1" }
  jest.mocked(listCatalogItems).mockResolvedValue({ data: [], count: 0 })
})

it("displays a recurring service in the real selector and finds it by typed query", async () => {
  const data = [
    { id: "product", name: "Coffee", kind: "product", is_recurring: false },
    { id: "service", name: "Cowork", kind: "service", is_recurring: true },
    { id: "plan", name: "Membership", kind: "digital_asset", is_recurring: true },
  ] as CatalogItem[]
  jest.mocked(listCatalogItems).mockImplementation(async params => ({
    data: params.isRecurring ? data.filter(item => item.is_recurring) : data,
    count: data.length,
  }))
  render(dialog())
  await openCatalog()
  expect(screen.queryByText("Coffee")).not.toBeInTheDocument()
  expect(screen.getByText("Cowork")).toBeInTheDocument()
  expect(screen.getByText("Membership")).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Select a recurring plan..."), { target: { value: "c" } })
  expect(screen.getByText("Cowork")).toBeInTheDocument()
  expect(listCatalogItems).toHaveBeenCalledWith({ siteId: "site-1", isRecurring: true, pageSize: 100 })
})

it("shows a skeleton while loading rather than an empty catalog", async () => {
  let finish!: (value: { data: CatalogItem[]; count: number }) => void
  jest.mocked(listCatalogItems).mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(dialog())
  expect(screen.getByRole("status", { name: "Loading products and services" })).toBeInTheDocument()
  expect(screen.queryByText("No recurring plans found")).not.toBeInTheDocument()
  finish({ data: [], count: 0 })
  await openCatalog()
  expect(screen.getByText("No recurring plans found")).toBeInTheDocument()
})

it("makes a recurring service searchable after a delayed successful response", async () => {
  let finish!: (value: { data: CatalogItem[]; count: number }) => void
  jest.mocked(listCatalogItems).mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(dialog())
  expect(screen.queryByPlaceholderText("Select a recurring plan...")).not.toBeInTheDocument()
  finish({ data: [{ id: "service", name: "Cowork", kind: "service", is_recurring: true }] as CatalogItem[], count: 1 })
  await openCatalog()
  fireEvent.change(screen.getByPlaceholderText("Select a recurring plan..."), { target: { value: "c" } })
  expect(screen.getByText("Cowork")).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByText("Cowork")) })
  expect(screen.getByPlaceholderText("Select a recurring plan...")).toHaveValue("Cowork")
})

it.each(["returned", "thrown"])("shows a safe error and retries a %s load failure", async failure => {
  if (failure === "returned") {
    jest.mocked(listCatalogItems).mockResolvedValueOnce({ data: [], count: 0, error: "private database detail" })
  } else {
    jest.mocked(listCatalogItems).mockRejectedValueOnce(new Error("private transport detail"))
  }
  render(dialog())
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load products and services.")
  expect(screen.queryByText(/private/)).not.toBeInTheDocument()
  expect(screen.queryByText("No recurring plans found")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await openCatalog()
  expect(screen.getByText("No recurring plans found")).toBeInTheDocument()
  expect(listCatalogItems).toHaveBeenCalledTimes(2)
})

it.each(["closed", "missing-site"])("does not fetch when %s", async state => {
  if (state === "missing-site") currentSite = null
  render(dialog(state !== "closed"))
  await waitFor(() => expect(listCatalogItems).not.toHaveBeenCalled())
})

it("loads the newly selected site without retaining the previous site's options", async () => {
  jest.mocked(listCatalogItems).mockImplementation(async params => ({
    data: [{ id: params.siteId, name: `Product for ${params.siteId}` }] as CatalogItem[], count: 1,
  }))
  const { rerender } = render(dialog())
  await openCatalog()
  expect(screen.getByText("Product for site-1")).toBeInTheDocument()
  currentSite = { id: "site-2" }
  rerender(dialog())
  expect(screen.queryByText("Product for site-1")).not.toBeInTheDocument()
  await openCatalog()
  expect(screen.getByText("Product for site-2")).toBeInTheDocument()
  expect(listCatalogItems).toHaveBeenLastCalledWith({ siteId: "site-2", isRecurring: true, pageSize: 100 })
})