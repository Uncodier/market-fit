import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import CopywritingPage from "@/app/copywriting/page"
import { createCopyTemplate, findCopyTestRecipients, getCopywriting, saveCopywriting } from "@/app/copywriting/actions"
import { sendTeamMemberIntervention } from "@/app/services/chat-send"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import type { CopywritingItem } from "@/app/copywriting/copywriting-model"
import { whatsappTemplateSourceTag } from "@/app/copywriting/template-model"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: jest.fn() }))
jest.mock("next/navigation", () => ({
  usePathname: () => "/copywriting",
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock("@/app/copywriting/actions", () => ({ getCopywriting: jest.fn(), saveCopywriting: jest.fn(), createCopyTemplate: jest.fn(), findCopyTestRecipients: jest.fn() }))
jest.mock("@/app/services/chat-send", () => ({ sendTeamMemberIntervention: jest.fn() }))

const email: CopywritingItem = {
  id: "a365be64-82ea-41b3-b7de-b91d08d6957b", title: "Contact agencies", content: "Hello team\nSecond line", copy_type: "cold_email",
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
    unobserve() {}
    disconnect() {}
  }
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

it("creates and updates a linked WhatsApp draft from the main editor without losing unsaved changes", async () => {
  const draft = { ...email, id: "draft", title: "Agency WhatsApp", content: "Hello {{name}}",
    tags: ["whatsapp-template", whatsappTemplateSourceTag(email.id)] }
  jest.mocked(createCopyTemplate).mockResolvedValueOnce({ id: draft.id, item: draft })
    .mockResolvedValueOnce({ id: draft.id, item: { ...draft, content: "Hi {{1}}" } })
  renderPage()
  fireEvent.click(await screen.findByRole("button", { name: `Editar texto: ${email.title}` }))
  fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Hello {{name}}" } })
  fireEvent.click(screen.getByRole("button", { name: "Crear plantilla de WhatsApp" }))
  expect(screen.getByLabelText("Contenido")).toHaveValue("Hello {{name}}")
  fireEvent.change(screen.getByLabelText("Nombre de la plantilla"), { target: { value: draft.title } })
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }))
  expect(await screen.findByText("Borrador guardado.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Volver" }))
  expect(screen.getByRole("dialog", { name: "Editar texto" })).toBeInTheDocument()
  expect(screen.getByLabelText("Contenido")).toHaveValue("Hello {{name}}")
  fireEvent.click(screen.getByRole("button", { name: "Actualizar plantilla de WhatsApp" }))
  expect(screen.getByLabelText("Nombre de la plantilla")).toHaveValue(draft.title)
  fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Hi {{1}}" } })
  fireEvent.click(screen.getByRole("button", { name: "Actualizar borrador" }))
  expect(await screen.findByText("Borrador guardado.")).toBeInTheDocument()
  expect(createCopyTemplate).toHaveBeenLastCalledWith("site-a", email.id, { kind: "whatsapp", title: draft.title, body: "Hi {{1}}" })
  fireEvent.click(screen.getByRole("button", { name: "Volver" }))
  fireEvent.click(screen.getByRole("button", { name: "Probar plantilla" }))
  expect(screen.getByRole("radio", { name: "WhatsApp" })).toBeChecked()
  expect(screen.getByRole("region", { name: "Vista previa" })).toHaveTextContent("[TEST] Hi {{1}}")
  fireEvent.click(screen.getByRole("radio", { name: "Correo electrónico" }))
  expect(screen.getByRole("region", { name: "Vista previa" })).toHaveTextContent("Hello {{name}}")
  expect(screen.queryByLabelText("{{1}}")).not.toBeInTheDocument()
  expect(saveCopywriting).not.toHaveBeenCalled()
  expect(sendTeamMemberIntervention).not.toHaveBeenCalled()
})

it.each([
  ["newsletter", "Correo electrónico", "QA · preview@example.test", "Offer for Ana"],
  ["whatsapp", "WhatsApp", "QA · +14155550101", "WhatsApp"],
] as const)("previews and tests %s with substituted variables from the main editor", async (kind, channel, contact, title) => {
  const lead = { id: "00000000-0000-4000-8000-000000000006", label: contact }
  jest.mocked(findCopyTestRecipients).mockResolvedValue([lead])
  jest.mocked(sendTeamMemberIntervention).mockResolvedValue({ success: true, conversation_id: "conversation" })
  renderPage()
  fireEvent.click(await screen.findByRole("button", { name: `Editar texto: ${email.title}` }))
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Offer for {{name}}" } })
  fireEvent.change(screen.getByLabelText("Contenido"), { target: { value: "Hi {{name}}, your code is {{1}}." } })
  fireEvent.click(screen.getByRole("button", { name: "Probar plantilla" }))
  const dialog = screen.getByRole("dialog", { name: "Probar plantilla" })
  fireEvent.click(within(dialog).getByRole("radio", { name: channel }))
  const picker = within(dialog).getByPlaceholderText("Busca contactos existentes")
  fireEvent.change(picker, { target: { value: "QA" } })
  fireEvent.click(await screen.findByText(contact))
  const send = within(dialog).getByRole("button", { name: "Enviar prueba" })
  expect(send).toBeDisabled()
  fireEvent.change(within(dialog).getByLabelText("{{name}}"), { target: { value: "Ana" } })
  fireEvent.change(within(dialog).getByLabelText("{{1}}"), { target: { value: "123" } })
  expect(within(dialog).getByRole("region", { name: "Vista previa" })).toHaveTextContent("Hi Ana, your code is 123.")
  fireEvent.click(send)
  expect(await screen.findByRole("link", { name: "Abrir conversación" })).toHaveAttribute("href", "/chat?conversationId=conversation")
  expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
  expect(sendTeamMemberIntervention).toHaveBeenCalledWith(undefined, "", undefined, undefined, {
    site_id: "site-a", copy_test: { copy_id: email.id, lead_id: lead.id, draft: { kind, title, body: "Hi Ana, your code is 123." } },
  })
  expect(findCopyTestRecipients).toHaveBeenCalledWith("site-a", "QA", kind)
  expect(createCopyTemplate).not.toHaveBeenCalled()
  expect(saveCopywriting).not.toHaveBeenCalled()
})

it("keeps the newsletter draft action available on the detail modal", async () => {
  jest.mocked(createCopyTemplate).mockResolvedValue({ id: "newsletter-draft" })
  renderPage()
  fireEvent.click(await screen.findByRole("button", { name: email.title }))
  fireEvent.click(screen.getByRole("button", { name: "Plantilla de boletín" }))
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }))
  expect(await screen.findByRole("link", { name: "Abrir borrador del boletín" })).toHaveAttribute("href", "/content/newsletter-draft")
  expect(sendTeamMemberIntervention).not.toHaveBeenCalled()
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