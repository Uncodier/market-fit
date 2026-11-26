import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import CopywritingPage from "@/app/copywriting/page"
import { getCopywriting, saveCopywriting } from "@/app/copywriting/actions"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import type { CopywritingItem } from "@/app/copywriting/copywriting-model"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("next/navigation", () => ({
  usePathname: () => "/copywriting",
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock("@/app/copywriting/actions", () => ({ getCopywriting: jest.fn(), saveCopywriting: jest.fn() }))

const email: CopywritingItem = {
  id: "email", title: "Contact agencies", content: "Hello team\nSecond line", copy_type: "cold_email",
  status: "approved", notes: "Keep it brief", target_audience: null, use_case: null,
}
const pitch: CopywritingItem = { ...email, id: "pitch", title: "Product intro", content: "Meet our product", copy_type: "sales_pitch" }

function renderPage(canWrite = true) {
  jest.mocked(getCopywriting).mockResolvedValue({ items: [email, pitch], canWrite })
  return render(<LocalizationProvider preferredLocale="es"><header><TopBarPrimaryActionsSlot /></header><CopywritingPage /></LocalizationProvider>)
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(useIsMobile).mockReturnValue(false)
  jest.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes("prefers-reduced-motion") }) as MediaQueryList)
})

const originalResizeObserver = globalThis.ResizeObserver
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as typeof ResizeObserver
})
afterAll(() => { globalThis.ResizeObserver = originalResizeObserver })
afterEach(() => jest.restoreAllMocks())

it("filters the real table and opens the localized read-only detail", async () => {
  renderPage(false)
  await screen.findByRole("button", { name: email.title })
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  fireEvent.click(screen.getByLabelText("Vista de tabla"))
  const table = screen.getByRole("table")
  expect(within(table).getAllByText("Aprobado")).toHaveLength(2)
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Correos de prospección/ }), { button: 0 })
  expect(screen.queryByText(pitch.title)).not.toBeInTheDocument()
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  fireEvent.click(screen.getByTitle("Buscar textos…"))
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "product" } })
  expect(screen.getByText("No se encontraron textos")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }))
  expect(screen.getByRole("button", { name: email.title })).toBeInTheDocument()
  expect(screen.queryByText(pitch.title)).not.toBeInTheDocument()
  fireEvent.keyDown(window, { metaKey: true, key: "k" })
  await waitFor(() => expect(screen.getByRole("searchbox")).toHaveFocus())
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "second line" } })
  fireEvent.click(screen.getByRole("button", { name: email.title }))
  const detail = screen.getByRole("dialog", { name: email.title })
  expect(within(detail).getByText("Keep it brief")).toBeInTheDocument()
  expect(within(detail).queryByRole("button", { name: "Editar texto" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Nuevo texto" })).not.toBeInTheDocument()
})

it("keeps the shared search visible on mobile, including after clearing", async () => {
  jest.mocked(useIsMobile).mockReturnValue(true)
  renderPage()
  await screen.findByRole("button", { name: email.title })
  const input = screen.getByRole("searchbox", { name: "Buscar textos…" })
  expect(screen.queryByRole("button", { name: "Buscar textos…" })).not.toBeInTheDocument()
  fireEvent.change(input, { target: { value: "agency query" } })
  expect(screen.getByText("No se encontraron textos")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }))
  expect(input).toHaveValue("")
  expect(screen.getByRole("searchbox")).toBe(input)
})

it("moves filters that do not fit into the responsive menu and applies a selected type", async () => {
  jest.mocked(useIsMobile).mockReturnValue(true)
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(180)
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const width = this.hasAttribute("data-tab-measure") ? 110 : this.hasAttribute("data-overflow-measure") ? 40 : 0
    return { width, height: 0, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 0, toJSON: () => ({}) }
  })
  renderPage(false)
  await screen.findByRole("button", { name: email.title })
  const filters = screen.getByRole("tablist", { name: "Tipo de texto" })
  expect(within(filters).getAllByRole("tab")).toHaveLength(1)
  fireEvent.keyDown(within(filters).getByRole("button", { name: "Más tipos de texto" }), { key: "Enter" })
  fireEvent.click(await screen.findByRole("menuitem", { name: /Presentaciones comerciales/ }))
  expect(within(filters).getByRole("tab", { name: /Presentaciones comerciales/, selected: true })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: pitch.title })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: email.title })).not.toBeInTheDocument()
})

it("opens the editor directly from the table action, not the read-only detail", async () => {
  renderPage()
  await screen.findByRole("button", { name: email.title })
  fireEvent.click(screen.getByLabelText("Vista de tabla"))
  fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: `Editar texto: ${email.title}` }))
  expect(screen.getByRole("dialog", { name: "Editar texto" })).toBeInTheDocument()
  expect(screen.getByLabelText("Título")).toHaveValue(email.title)
})

it("places creation in the topbar and shows the saved row in detail", async () => {
  renderPage()
  jest.mocked(saveCopywriting).mockResolvedValue({ ...email, id: "created", title: "New draft", content: "My copy", copy_type: "other", status: "draft" })
  fireEvent.click(await within(screen.getByRole("banner")).findByRole("button", { name: "Nuevo texto" }))
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "New draft" } })
  fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "My copy" } })
  fireEvent.submit(screen.getByRole("button", { name: "Guardar texto" }).closest("form")!)
  expect(await screen.findByRole("dialog", { name: "New draft" })).toBeInTheDocument()
  expect(saveCopywriting).toHaveBeenCalledWith("site-a", null, expect.objectContaining({ title: "New draft", content: "My copy", copy_type: "other", status: "draft" }))
})

it("retains the draft and shows an error on failed edit, then updates on retry", async () => {
  renderPage()
  jest.mocked(saveCopywriting).mockRejectedValueOnce(new Error("DB rejected update"))
    .mockResolvedValueOnce({ ...email, title: "New agency copy" })
  fireEvent.click(await screen.findByRole("button", { name: `Editar texto: ${email.title}` }))
  expect(screen.getByLabelText("Título")).toHaveValue(email.title)
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "New agency copy" } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar texto" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar el texto")
  expect(screen.getByLabelText("Título")).toHaveValue("New agency copy")
  fireEvent.click(screen.getByRole("button", { name: "Guardar texto" }))
  await waitFor(() => expect(screen.getByRole("dialog", { name: "New agency copy" })).toBeInTheDocument())
  expect(saveCopywriting).toHaveBeenLastCalledWith("site-a", email.id, expect.objectContaining({ title: "New agency copy", status: "approved", copy_type: "cold_email" }))
})