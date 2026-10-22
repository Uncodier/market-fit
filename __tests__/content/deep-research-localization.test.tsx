import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import DeepResearchPage from "@/app/content/deepResearch/page"
import { PayoutsTitle } from "@/app/admin/payouts/PayoutsTitle"
import english from "@/app/context/locales/screens/content-en.json"
import spanish from "@/app/context/locales/screens/content-es.json"

type Locale = "en" | "es"
type Params = Record<string, string | number>
let mockLocale: Locale = "en"
const dictionaries: Record<Locale, Record<string, string>> = { en: english, es: spanish }
const mockTranslators = Object.fromEntries(
  Object.entries(dictionaries).map(([locale, messages]) => [
    locale,
    (key: string, params: Params = {}) => Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      messages[key] || key,
    ),
  ]),
) as Record<Locale, (key: string, params?: Params) => string>

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: mockLocale, t: mockTranslators[mockLocale] }),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: () => null }))
jest.mock("@/app/components/ui/date-range-picker", () => ({ CalendarDateRangePicker: () => null }))
jest.mock("@/app/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock("@/app/components/ui/select", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    Select: ({ value, onValueChange, children }: {
      value: string
      onValueChange: (value: string) => void
      children: React.ReactNode
    }) => <select aria-label={value === "global" || value === "latam" ? "region" : "timeRange"}
      value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: Wrapper,
  }
})

describe("deep research and payouts localization", () => {
  beforeEach(() => {
    mockLocale = "en"
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("keeps overlay keys and interpolation parameters identical", () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort())
    for (const [key, message] of Object.entries(english)) {
      const translated = dictionaries.es[key]
      expect(translated.trim()).not.toBe("")
      expect(translated.match(/\{\{\w+\}\}/g) || []).toEqual(message.match(/\{\{\w+\}\}/g) || [])
    }
  })

  it("updates labels, browser title and breadcrumbs without resetting stored filter values", () => {
    const breadcrumb = jest.fn()
    window.addEventListener("breadcrumb:update", breadcrumb)
    const { rerender } = render(<DeepResearchPage />)
    fireEvent.change(screen.getByPlaceholderText(english["content.deepResearch.searchPlaceholder"]), {
      target: { value: "Existing query" },
    })
    fireEvent.change(screen.getByLabelText("region"), { target: { value: "latam" } })
    fireEvent.change(screen.getByLabelText("timeRange"), { target: { value: "lastWeek" } })

    mockLocale = "es"
    rerender(<DeepResearchPage />)
    act(() => { jest.advanceTimersByTime(0) })
    expect(screen.getByRole("heading", { name: "Investigación profunda" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(spanish["content.deepResearch.searchPlaceholder"])).toHaveValue("Existing query")
    expect(screen.getByLabelText("region")).toHaveValue("latam")
    expect(screen.getByLabelText("timeRange")).toHaveValue("lastWeek")
    expect(screen.getByRole("option", { name: "América Latina" })).toHaveValue("latam")
    expect(document.title).toBe(spanish["content.deepResearch.browserTitle"])
    expect(breadcrumb.mock.calls.at(-1)?.[0].detail).toEqual({
      title: "Investigación profunda", path: "/content/deepResearch", section: "content",
    })
    window.removeEventListener("breadcrumb:update", breadcrumb)
  })

  it("localizes source feedback while preserving URLs", () => {
    mockLocale = "es"
    render(<DeepResearchPage />)
    const sourceInput = screen.getByPlaceholderText(spanish["content.deepResearch.sourceUrlPlaceholder"])
    fireEvent.change(sourceInput, { target: { value: "example.com" } })
    fireEvent.click(screen.getByRole("button", { name: "Añadir fuente" }))
    expect(toast.success).toHaveBeenCalledWith(spanish["content.deepResearch.sourceAdded"])
    expect(screen.getByText("https://example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Fuentes (1)" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Eliminar fuente https://example.com" }))
    expect(screen.getByText(spanish["content.deepResearch.noSources"])).toBeInTheDocument()
    fireEvent.change(sourceInput, { target: { value: "http://" } })
    fireEvent.click(screen.getByRole("button", { name: "Añadir fuente" }))
    expect(toast.error).toHaveBeenCalledWith(spanish["content.deepResearch.invalidSourceUrl"])
  })

  it("localizes loading, results and sample copy even after a language switch", async () => {
    const { rerender } = render(<DeepResearchPage />)
    fireEvent.change(screen.getByPlaceholderText(english["content.deepResearch.searchPlaceholder"]), {
      target: { value: "Research query" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Search" }))
    mockLocale = "es"
    rerender(<DeepResearchPage />)
    expect(screen.getByRole("button", { name: "Buscando..." })).toBeDisabled()
    expect(screen.getByText(spanish["content.deepResearch.searchingSources"])).toBeInTheDocument()
    await act(async () => { jest.advanceTimersByTime(2000) })
    expect(screen.getByRole("heading", { name: spanish["content.deepResearch.resultsTitle"] })).toBeInTheDocument()
    expect(screen.getByText("1 resultados encontrados")).toBeInTheDocument()
    expect(screen.getByText("95% de coincidencia")).toBeInTheDocument()
    expect(screen.getByText(spanish["content.deepResearch.sampleDescription"])).toBeInTheDocument()
    expect(screen.getByRole("link", { name: spanish["content.deepResearch.sampleTitle"] })).toHaveAttribute("href", "https://example.com")
    expect(screen.getByRole("link", { name: "Ver fuente" })).toHaveAttribute("href", "https://example.com")
  })

  it("localizes the payouts title in a client-only boundary", () => {
    const { rerender } = render(<PayoutsTitle />)
    expect(screen.getByRole("heading", { name: "Platform Payouts" })).toBeInTheDocument()
    mockLocale = "es"
    rerender(<PayoutsTitle />)
    expect(screen.getByRole("heading", { name: "Pagos de la plataforma" })).toBeInTheDocument()
    expect(screen.getByText(spanish["content.payouts.description"])).toBeInTheDocument()
  })
})