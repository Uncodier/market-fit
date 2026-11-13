import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { ProductInventoryCard } from "@/app/catalog/components/ProductInventoryCard"
import { listLocations, listInventoryLevels, setInventoryLevel } from "@/app/inventory/actions"
import type { InventoryLevel, Location } from "@/app/types"

let mockSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: mockSiteId } }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))
jest.mock("@/app/inventory/actions", () => ({
  listLocations: jest.fn(), listInventoryLevels: jest.fn(), setInventoryLevel: jest.fn(),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), promise: jest.fn() } }))

const locations = Array.from({ length: 4 }, (_, index) => ({
  id: `location-${index}`, name: `Store ${index + 1}`, site_id: "site-1",
  is_active: true, is_default: index === 0,
})) as Location[]

function setup() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ProductInventoryCard catalogItemId="item-1" />
    </SWRConfig>,
  )
}

async function openDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "Add Stock" }))
  return within(screen.getByRole("dialog"))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSiteId = "site-1"
  jest.mocked(listLocations).mockResolvedValue({ data: locations })
  jest.mocked(listInventoryLevels).mockResolvedValue({ data: [], count: 0 })
  jest.mocked(setInventoryLevel).mockResolvedValue({ data: { id: "level-1" } as InventoryLevel })
  HTMLElement.prototype.scrollIntoView = jest.fn()
})

it("offers all four existing locations and saves stock at the selected location", async () => {
  setup()
  const dialog = await openDialog()
  expect(dialog.queryByText(/Add a physical location/)).not.toBeInTheDocument()
  fireEvent.keyDown(dialog.getByRole("combobox"), { key: "ArrowDown" })
  const options = await screen.findAllByRole("option")
  expect(options.map(option => option.textContent)).toEqual(locations.map(location => location.name))
  fireEvent.click(screen.getByRole("option", { name: "Store 3" }))
  fireEvent.change(dialog.getByRole("spinbutton"), { target: { value: "12" } })
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Save" })))
  await screen.findByRole("button", { name: "Add Stock" })
  expect(setInventoryLevel).toHaveBeenCalledWith("site-1", "location-2", "item-1", 12)
})

it.each(["locations", "levels"])("does not report missing locations on a %s error and recovers on retry", async failure => {
  if (failure === "locations") {
    jest.mocked(listLocations).mockResolvedValueOnce({ data: [], error: "Private database detail" })
  } else {
    jest.mocked(listInventoryLevels).mockResolvedValueOnce({ data: [], count: 0, error: "Private database detail" })
  }
  setup()
  const dialog = await openDialog()
  expect(dialog.getByRole("alert")).toHaveTextContent("Error loading inventory")
  expect(dialog.queryByText(/Add a physical location/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Private database detail/)).not.toBeInTheDocument()
  await act(async () => fireEvent.click(dialog.getByRole("button", { name: "Retry" })))
  expect(await within(await screen.findByRole("dialog")).findByRole("combobox")).toBeInTheDocument()
})

it("shows the add-location prompt only after a successful empty location read", async () => {
  jest.mocked(listLocations).mockResolvedValue({ data: [] })
  setup()
  const dialog = await openDialog()
  expect(dialog.getByText(/Add a physical location/)).toBeInTheDocument()
})

it("ignores a late location result after switching sites", async () => {
  let finish!: (result: { data: Location[] }) => void
  jest.mocked(listLocations).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = setup()
  expect(screen.queryByRole("button", { name: "Add Stock" })).not.toBeInTheDocument()
  mockSiteId = "site-2"
  view.rerender(
    <SWRConfig value={{ dedupingInterval: 0 }}><ProductInventoryCard catalogItemId="item-1" /></SWRConfig>,
  )
  const dialog = await openDialog()
  await act(async () => finish({ data: [{ ...locations[0], name: "Stale store" }] }))
  fireEvent.keyDown(dialog.getByRole("combobox"), { key: "ArrowDown" })
  await screen.findByRole("option", { name: "Store 1" })
  expect(screen.queryByRole("option", { name: "Stale store" })).not.toBeInTheDocument()
})