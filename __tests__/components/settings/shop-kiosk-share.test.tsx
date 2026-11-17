import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { listLocations } from "@/app/inventory/actions"
import { ShopKioskShareCard } from "@/app/components/settings/ShopKioskShareCard"
import { downloadSettingsQr } from "@/app/components/settings/share-qr"

jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn() }))
jest.mock("react-qr-code", () => ({ __esModule: true, default: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} /> }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/components/settings/share-qr", () => ({
  ...jest.requireActual("@/app/components/settings/share-qr"), downloadSettingsQr: jest.fn(),
}))

const locations = [{ id: "location-1", name: "Main counter" }, { id: "location-2", name: "Second counter" }]
const load = listLocations as jest.Mock
const writeText = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  load.mockResolvedValue({ data: locations })
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  Element.prototype.scrollIntoView = jest.fn()
  Element.prototype.hasPointerCapture = jest.fn().mockReturnValue(false)
})

it("renders one card and updates the QR, URL, copy and download for the selected location", async () => {
  render(<ShopKioskShareCard siteId="site-1" />)
  expect(screen.getByRole("status")).toHaveTextContent("Loading locations")
  expect(await screen.findByTestId("qr")).toHaveAttribute("data-value", `${window.location.origin}/shop/location-1/`)
  expect(load).toHaveBeenCalledWith("site-1")
  expect(screen.getAllByRole("region", { name: "Location Kiosks" })).toHaveLength(1)
  expect(screen.getByRole("tablist", { name: "Location" })).toHaveClass("flex-wrap", "h-auto", "w-full")
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Second counter" }), { button: 0, ctrlKey: false })
  expect(screen.getByRole("tab", { name: "Second counter" })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByRole("tabpanel", { name: "Second counter" })).toBeVisible()
  const url = `${window.location.origin}/shop/location-2/`
  expect(screen.getAllByTestId("qr")).toHaveLength(1)
  expect(screen.getByTestId("qr")).toHaveAttribute("data-value", url)
  expect(screen.getByRole("link", { name: "Open kiosk" })).toHaveAttribute("href", url)
  expect(screen.getByRole("link", { name: "Open kiosk" })).toHaveAttribute("rel", "noopener noreferrer")
  fireEvent.click(screen.getByRole("button", { name: "Copy kiosk link" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
  fireEvent.click(screen.getByRole("button", { name: "Download" }))
  expect(downloadSettingsQr).toHaveBeenCalledWith(screen.getByTestId("qr").parentElement!.id, "location-2-self-service-qr.png")
})

it("does not offer links when no locations exist", async () => {
  load.mockResolvedValue({ data: [] })
  render(<ShopKioskShareCard siteId="site-1" />)
  expect(await screen.findByText(/Add a location in Company settings/)).toBeVisible()
  expect(screen.queryByTestId("qr")).not.toBeInTheDocument()
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
})

it("shows a shaped, non-interactive skeleton until locations load", async () => {
  render(<ShopKioskShareCard siteId="site-1" />)
  const status = screen.getByRole("status")
  expect(status).toHaveAttribute("aria-busy", "true")
  expect(status.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  expect(status.querySelector(".h-\\[72px\\]")).toBeInTheDocument()
  expect(status.querySelectorAll(".animate-pulse")).toHaveLength(13)
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  await screen.findByTestId("qr")
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("supports keyboard selection and wraps long location names", async () => {
  const longName = "A very long location name that should wrap on small screens"
  load.mockResolvedValue({ data: [locations[0], { ...locations[1], name: longName }] })
  render(<ShopKioskShareCard siteId="site-1" />)
  const first = await screen.findByRole("tab", { name: "Main counter" })
  const second = screen.getByRole("tab", { name: longName })
  expect(second).toHaveClass("whitespace-normal", "max-w-full", "min-h-7", "py-1", "text-xs")
  act(() => first.focus())
  fireEvent.keyDown(first, { key: "ArrowRight" })
  await waitFor(() => expect(second).toHaveFocus())
  expect(second).toHaveAttribute("aria-selected", "true")
  expect(screen.getByTestId("qr")).toHaveAttribute("data-value", `${window.location.origin}/shop/location-2/`)
})

it("does not request locations without a saved site", () => {
  render(<ShopKioskShareCard />)
  expect(load).not.toHaveBeenCalled()
  expect(screen.getByText(/Save your store/)).toBeVisible()
})

it("hides the selector for one location while keeping its QR and sharing actions", async () => {
  load.mockResolvedValue({ data: [locations[0]] })
  render(<ShopKioskShareCard siteId="site-1" />)
  const url = `${window.location.origin}/shop/location-1/`
  expect(await screen.findByTestId("qr")).toHaveAttribute("data-value", url)
  expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument()
  expect(screen.getByRole("group", { name: "Location Kiosks" })).toBeVisible()
  expect(screen.getByRole("link", { name: "Open kiosk" })).toHaveAttribute("href", url)
  fireEvent.click(screen.getByRole("button", { name: "Copy kiosk link" }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
  fireEvent.click(screen.getByRole("button", { name: "Download" }))
  expect(downloadSettingsQr).toHaveBeenCalledWith(screen.getByTestId("qr").parentElement!.id, "location-1-self-service-qr.png")
})

it.each(["response", "rejection"])("shows a retryable error on a failed %s instead of an empty list", async (failure) => {
  if (failure === "response") load.mockResolvedValueOnce({ data: [], error: "Unavailable" })
  else load.mockRejectedValueOnce(new Error("Unavailable"))
  render(<ShopKioskShareCard siteId="site-1" />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load locations")
  expect(screen.queryByTestId("qr")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByTestId("qr")).toBeVisible()
  expect(load).toHaveBeenCalledTimes(2)
})

it("discards late results from a previous site", async () => {
  let resolveOld!: (value: { data: typeof locations }) => void
  load.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
  const { rerender } = render(<ShopKioskShareCard siteId="old-site" />)
  load.mockResolvedValueOnce({ data: [{ id: "new-location", name: "New counter" }] })
  rerender(<ShopKioskShareCard siteId="new-site" />)
  expect(await screen.findByTestId("qr")).toHaveAttribute("data-value", `${window.location.origin}/shop/new-location/`)
  await act(async () => resolveOld({ data: locations }))
  expect(screen.getByTestId("qr")).toHaveAttribute("data-value", `${window.location.origin}/shop/new-location/`)
})

it("hides the previous site's links immediately while the next site loads", async () => {
  const { rerender } = render(<ShopKioskShareCard siteId="site-1" />)
  await screen.findByTestId("qr")
  load.mockReturnValueOnce(new Promise(() => {}))
  rerender(<ShopKioskShareCard siteId="site-2" />)
  expect(screen.queryByTestId("qr")).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toBeVisible()
})

it("reports clipboard failures", async () => {
  writeText.mockRejectedValueOnce(new Error("Denied"))
  render(<ShopKioskShareCard siteId="site-1" />)
  await screen.findByTestId("qr")
  fireEvent.click(screen.getByRole("button", { name: "Copy kiosk link" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to copy kiosk link"))
})