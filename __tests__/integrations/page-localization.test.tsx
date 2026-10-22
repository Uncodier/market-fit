import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import IntegrationsPage from "@/app/integrations/page"
import { LocalizationProvider } from "@/app/context/LocalizationContext"
import { listWebhookEndpoints, listWebhookSubscriptions } from "@/lib/webhooks"
import { toast } from "sonner"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" }, isLoading: false }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/quick-nav", () => ({
  QuickNav: ({ sections }: { sections: { id: string; title: string; children?: { id: string; title: string }[] }[] }) => <nav aria-label="Sections">
    {sections.map(section => <div key={section.id}>{section.title}{section.children?.map(child => <span key={child.id}>{child.title}</span>)}</div>)}
  </nav>,
}))
jest.mock("@/app/components/webhooks/create-endpoint-dialog", () => ({ CreateEndpointDialog: ({ triggerLabel }: { triggerLabel: string }) => <button>{triggerLabel}</button> }))
jest.mock("@/app/components/webhooks/webhook-endpoint-card", () => ({ WebhookEndpointCard: () => null }))
jest.mock("@/app/components/webhooks/test-endpoint-dialog", () => ({ TestEndpointDialog: () => null }))
jest.mock("@/app/components/integrations/channels-section", () => ({ ChannelsSection: () => null }))
jest.mock("@/app/components/settings/ComposioSection", () => ({ ComposioSection: () => null }))
jest.mock("@/app/integrations/components/MarketplaceConfigurationCards", () => ({ MarketplaceConfigurationCards: () => null }))
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/webhooks", () => ({ listWebhookEndpoints: jest.fn(), listWebhookSubscriptions: jest.fn(), deleteWebhookEndpoint: jest.fn(), upsertSubscription: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(listWebhookEndpoints).mockResolvedValue([{ id: "endpoint", name: "" }] as never)
  jest.mocked(listWebhookSubscriptions).mockResolvedValue([])
})

it("updates navigation, endpoint fallback and controls in Spanish without reloading operations", async () => {
  const view = render(<LocalizationProvider preferredLocale="en"><IntegrationsPage /></LocalizationProvider>)
  await screen.findByText("Endpoint 1")
  await waitFor(() => expect(listWebhookSubscriptions).toHaveBeenCalledTimes(1))
  expect(screen.getByRole("heading", { name: "Outbound Webhooks" })).toBeInTheDocument()
  view.rerender(<LocalizationProvider preferredLocale="es"><IntegrationsPage /></LocalizationProvider>)
  expect(screen.getByRole("heading", { name: "Webhooks salientes" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Agregar webhook" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Copiar URL" })).toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "URL del webhook de flujos de trabajo" })).toHaveAttribute("readonly")
  expect(listWebhookEndpoints).toHaveBeenCalledTimes(1)
  expect(listWebhookSubscriptions).toHaveBeenCalledTimes(1)
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Canales" }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Correo del agente")).toBeInTheDocument()
  expect(screen.getByText("Correo SMTP con tu propia clave (BYOK)")).toBeInTheDocument()
  expect(listWebhookEndpoints).toHaveBeenCalledTimes(1)
})

it("displays the translated copy failure without modifying the webhook URL", async () => {
  const writeText = jest.fn().mockRejectedValue(new Error("Clipboard unavailable"))
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  render(<LocalizationProvider preferredLocale="es"><IntegrationsPage /></LocalizationProvider>)
  const input = screen.getByRole("textbox", { name: "URL del webhook de flujos de trabajo" }) as HTMLInputElement
  fireEvent.click(screen.getByRole("button", { name: "Copiar URL" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo copiar la URL"))
  expect(writeText).toHaveBeenCalledWith(input.value)
  expect(input.value).toMatch(/\/api\/workflows\/webhook$/)
})