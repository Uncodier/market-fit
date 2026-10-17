import { useState, type ComponentProps, type ReactNode } from "react"
import { fireEvent, render, screen, within, type RenderOptions } from "@testing-library/react"
import { MarketplaceFilters } from "@/app/marketplace/MarketplaceFilters"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import type { MarketplaceListingFilters } from "@/app/marketplace/marketplace-product-filters"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ displayCurrency: "MXN" }),
}))

const onChange = jest.fn()
const openSheet = jest.fn()
const props: ComponentProps<typeof MarketplaceFilters> = {
  filters: {}, onChange, isLoading: false, locationRestricted: false,
  regions: [{ country: "united states", label: "United States", count: 70 }, { country: "mexico", label: "Mexico", count: 42 }],
  buyerLocation: {
    effectiveBuyerGeo: { country: "Mexico", city: "Celaya" }, label: "Celaya", showPill: true,
    selectedLocationId: null, sheetOpen: false, setSheetOpen: openSheet, locating: false,
    applyPlace: jest.fn(), applyStore: jest.fn(), useMyLocation: jest.fn(), searchPlaces: jest.fn(),
  },
}

function Harness({ filters: initialFilters = {} }: { filters?: MarketplaceListingFilters }) {
  const [filters, setFilters] = useState(initialFilters)
  return <MarketplaceFilters {...props} filters={filters} onChange={(next) => { setFilters(next); onChange(next) }} />
}

beforeEach(() => jest.clearAllMocks())

const renderFilters = (ui: ReactNode, options?: RenderOptions) => render(ui, {
  wrapper: ({ children }) => <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider>,
  ...options,
})

it("shows current location as text and a Set link that opens the existing sheet", () => {
  renderFilters(<MarketplaceFilters {...props} locationRestricted />)
  expect(screen.getByText("Celaya").tagName).toBe("P")
  expect(screen.queryByRole("button", { name: "Celaya" })).not.toBeInTheDocument()
  expect(screen.getByText("Some items are not available at your location.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Set your location" }))
  expect(openSheet).toHaveBeenCalledWith(true)
})

it("renders actual country counts and switches geography without overriding buyer location", () => {
  renderFilters(<Harness />)
  expect(screen.getByRole("radio", { name: "All regions" })).toBeChecked()
  expect(within(screen.getByRole("radio", { name: "Mexico" }).closest("label")!).getByText("42")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("radio", { name: "United States" }))
  expect(onChange).toHaveBeenLastCalledWith({ regionCountry: "united states", nearMe: undefined })
  expect(screen.getByText("Celaya")).toBeInTheDocument()
  expect(openSheet).not.toHaveBeenCalled()
  expect(props.buyerLocation.applyPlace).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("radio", { name: "Near me" }))
  expect(onChange).toHaveBeenLastCalledWith({ regionCountry: undefined, nearMe: true })
  fireEvent.click(screen.getByRole("radio", { name: "All regions" }))
  expect(onChange).toHaveBeenLastCalledWith({ regionCountry: undefined, nearMe: undefined })
})

it("prompts for buyer location when Near me has no location", () => {
  renderFilters(<MarketplaceFilters {...props} buyerLocation={{ ...props.buyerLocation, effectiveBuyerGeo: undefined }} />)
  expect(screen.getByText("Not set")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("radio", { name: "Near me" }))
  expect(openSheet).toHaveBeenCalledWith(true)
  expect(onChange).toHaveBeenCalledWith({ nearMe: true, regionCountry: undefined })
})

it("applies price bounds only on Apply using the display currency", () => {
  renderFilters(<Harness />)
  expect(screen.getByText("Price range (MXN)")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Min price"), { target: { value: "0" } })
  fireEvent.change(screen.getByLabelText("Max price"), { target: { value: "25.50" } })
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(onChange).toHaveBeenLastCalledWith({ minPrice: 0, maxPrice: 25.5, priceCurrency: "MXN" })
})

it("rejects inverted bounds without requesting misleading results", () => {
  renderFilters(<Harness />)
  fireEvent.change(screen.getByLabelText("Min price"), { target: { value: "50" } })
  fireEvent.change(screen.getByLabelText("Max price"), { target: { value: "10" } })
  fireEvent.click(screen.getByRole("button", { name: "Apply" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Minimum price must not exceed maximum price.")
  expect(onChange).not.toHaveBeenCalled()
})

it("toggles Available now and clears geography, prices and availability together", () => {
  renderFilters(<Harness filters={{ regionCountry: "mexico", minPrice: 10, maxPrice: 30, priceCurrency: "MXN" }} />)
  fireEvent.click(screen.getByRole("checkbox", { name: "Available now" }))
  expect(onChange).toHaveBeenLastCalledWith({ regionCountry: "mexico", minPrice: 10, maxPrice: 30, priceCurrency: "MXN", availableOnly: true })
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
  expect(onChange).toHaveBeenLastCalledWith({})
  expect(screen.getByRole("radio", { name: "All regions" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Available now" })).not.toBeChecked()
  expect(screen.getByLabelText("Min price")).toHaveValue(null)
  expect(screen.getByLabelText("Max price")).toHaveValue(null)
  expect(screen.getByText("Celaya")).toBeInTheDocument()
})

it("keeps a selected region outside the top six available and removes stale counts while loading", () => {
  const regions = Array.from({ length: 8 }, (_, index) => ({ country: `country-${index}`, label: `Country ${index}`, count: 10 - index }))
  const { rerender } = renderFilters(<MarketplaceFilters {...props} regions={regions} filters={{ regionCountry: "country-7" }} />)
  expect(screen.getAllByRole("radio")).toHaveLength(9)
  expect(screen.getByRole("radio", { name: "Country 7" })).toBeChecked()
  expect(screen.queryByRole("radio", { name: "Country 6" })).not.toBeInTheDocument()
  rerender(<MarketplaceFilters {...props} regions={[]} filters={{ regionCountry: "country-7" }} isLoading />)
  expect(screen.getByRole("status", { name: "Loading regions" }).textContent).toBe("")
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(6)
  expect(screen.queryByText("3")).not.toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Country 7" })).toBeChecked()
  expect(screen.queryByText(/Updating regions/)).not.toBeInTheDocument()
})

it.each([1, 2, 6, 8])("renders skeleton rows for the %i known regions, capped at six", (count) => {
  const regions = Array.from({ length: count }, (_, index) => ({ country: `country-${index}`, label: `Country ${index}`, count: 10 }))
  renderFilters(<MarketplaceFilters {...props} regions={regions} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(Math.min(count, 6))
  expect(screen.getAllByRole("radio")).toHaveLength(2)
  expect(screen.getByRole("radio", { name: "All regions" })).toBeChecked()
  expect(screen.getByRole("radio", { name: "Near me" })).toBeEnabled()
  expect(screen.getByRole("radiogroup", { name: "Top regions" })).toHaveAttribute("aria-busy", "true")
  expect(screen.queryByText(/Updating regions/)).not.toBeInTheDocument()
})

it("uses SSR regions to size skeletons before the first filtered response", () => {
  renderFilters(<MarketplaceFilters {...props} regions={[]} initialRegions={props.regions} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(2)
})

it("uses six estimated skeletons when no region data is known yet", () => {
  renderFilters(<MarketplaceFilters {...props} regions={[]} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(6)
})

it("preserves the previous row count during refresh and adopts the new result", () => {
  const { rerender } = renderFilters(<MarketplaceFilters {...props} />)
  rerender(<MarketplaceFilters {...props} regions={[]} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(2)
  expect(screen.queryByRole("radio", { name: "Mexico" })).not.toBeInTheDocument()
  expect(screen.queryByText("42")).not.toBeInTheDocument()
  rerender(<MarketplaceFilters {...props} regions={[props.regions[1]]} />)
  expect(screen.queryByTestId("region-skeleton")).not.toBeInTheDocument()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  expect(screen.getByRole("radio", { name: "Mexico" })).toBeInTheDocument()
  expect(screen.getByText("42")).toBeInTheDocument()
  expect(screen.getByRole("radiogroup", { name: "Top regions" })).toHaveAttribute("aria-busy", "false")
  rerender(<MarketplaceFilters {...props} regions={[]} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(1)
})

it("keeps a selected top region interactive without adding an extra placeholder row", () => {
  renderFilters(<MarketplaceFilters {...props} filters={{ regionCountry: "mexico" }} isLoading />)
  expect(screen.getAllByTestId("region-skeleton")).toHaveLength(1)
  expect(screen.getByRole("radio", { name: "Mexico" })).toBeChecked()
  expect(screen.queryByText("42")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("radio", { name: "All regions" }))
  expect(onChange).toHaveBeenCalledWith({ regionCountry: undefined, nearMe: undefined })
})

it("does not reserve region rows after a confirmed empty result", () => {
  const { rerender } = renderFilters(<MarketplaceFilters {...props} regions={[]} />)
  rerender(<MarketplaceFilters {...props} regions={[]} isLoading />)
  expect(screen.queryByTestId("region-skeleton")).not.toBeInTheDocument()
  expect(screen.getAllByRole("radio")).toHaveLength(2)
  expect(screen.getByRole("radiogroup", { name: "Top regions" })).toHaveAttribute("aria-busy", "true")
})

it("reconciles persisted price changes and explains a different applied currency", () => {
  const { rerender } = renderFilters(<MarketplaceFilters {...props} filters={{ minPrice: 12, priceCurrency: "USD" }} />)
  expect(screen.getByLabelText("Min price")).toHaveValue(12)
  expect(screen.getByText("Applied range: USD. Apply to use MXN.")).toBeInTheDocument()
  rerender(<MarketplaceFilters {...props} filters={{ minPrice: 99, priceCurrency: "MXN" }} />)
  expect(screen.getByLabelText("Min price")).toHaveValue(99)
})