import React from "react"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import IntegrationsPage from "@/app/integrations/page"
import { listWebhookEndpoints, listWebhookSubscriptions } from "@/lib/webhooks"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
const mockSiteState = { currentSite: { id: "site" }, isLoading: false }
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => mockSiteState }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/quick-nav", () => ({
  QuickNav: ({ sections }: { sections: { id: string; title: string }[] }) => <nav aria-label="Sections">
    {sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
  </nav>,
}))
jest.mock("@/app/components/webhooks/create-endpoint-dialog", () => ({ CreateEndpointDialog: () => null }))
jest.mock("@/app/components/webhooks/webhook-endpoint-card", () => ({ WebhookEndpointCard: () => null }))
jest.mock("@/app/components/webhooks/test-endpoint-dialog", () => ({ TestEndpointDialog: () => null }))
jest.mock("@/app/components/integrations/channels-section", () => ({ ChannelsSection: () => null }))
jest.mock("@/app/components/settings/ComposioSection", () => ({ ComposioSection: () => <div>Composio settings</div> }))
jest.mock("@/app/integrations/components/MarketplaceConfigurationCards", () => ({ MarketplaceConfigurationCards: () => <div>Marketplace settings</div> }))
jest.mock("@/app/integrations/components/OpenRouterSection", () => ({ OpenRouterSection: ({ siteId }: { siteId: string }) => <h3>OpenRouter settings for {siteId}</h3> }))
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/webhooks", () => ({ listWebhookEndpoints: jest.fn().mockResolvedValue([]), listWebhookSubscriptions: jest.fn(), deleteWebhookEndpoint: jest.fn(), upsertSubscription: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

beforeEach(() => { mockSiteState.isLoading = false; mockSiteState.currentSite.id = 'site'; jest.clearAllMocks() })

it("uses the Models card skeleton while the site loads and preserves the selected tab", async () => {
  mockSiteState.isLoading = true
  const view = render(<IntegrationsPage />)
  await act(async () => {})
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Models" }), { button: 0, ctrlKey: false })
  expect(screen.getByRole("status", { name: "Loading OpenRouter connection" })).toHaveAttribute("aria-busy", "true")
  expect(screen.getByRole("tab", { name: "Models" })).toHaveAttribute("aria-selected", "true")
  expect(screen.queryByRole("heading", { name: /OpenRouter settings/ })).not.toBeInTheDocument()
  mockSiteState.isLoading = false
  view.rerender(<IntegrationsPage />)
  expect(screen.getByRole("heading", { name: "OpenRouter settings for site" })).toBeInTheDocument()
  expect(screen.queryByRole("status", { name: "Loading OpenRouter connection" })).not.toBeInTheDocument()
  expect(listWebhookEndpoints).not.toHaveBeenCalled()
  expect(listWebhookSubscriptions).not.toHaveBeenCalled()
})

it('never loads subscriptions from a hidden or retired endpoint request', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof listWebhookEndpoints>>) => void
  jest.mocked(listWebhookEndpoints).mockReturnValueOnce(new Promise(done => { resolve = done }))
  const view = render(<IntegrationsPage />)
  const signal = jest.mocked(listWebhookEndpoints).mock.calls[0][1]
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Models' }), { button: 0 })
  expect(signal.aborted).toBe(true)
  mockSiteState.currentSite.id = 'another-site'
  view.rerender(<IntegrationsPage />)
  await act(async () => resolve([{ id: 'old', name: 'Old endpoint', target_url: '' }]))
  expect(listWebhookEndpoints).toHaveBeenCalledTimes(1)
  expect(listWebhookSubscriptions).not.toHaveBeenCalled()
  expect(screen.queryByText('Old endpoint')).toBeNull()
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'operations.integrations.webhooks' }), { button: 0 })
  await act(async () => {})
  expect(listWebhookEndpoints).toHaveBeenLastCalledWith('another-site', expect.any(AbortSignal))
})

it("shows OpenRouter only in Models with its own quick navigation", async () => {
  render(<IntegrationsPage />)
  expect(screen.queryByRole("heading", { name: /OpenRouter settings/ })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Models" }), { button: 0, ctrlKey: false })
  expect(await screen.findByRole("heading", { name: "OpenRouter settings for site" })).toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Models" })).toHaveAttribute("aria-selected", "true")
  expect(within(screen.getByRole("navigation")).getByRole("link", { name: "OpenRouter" })).toHaveAttribute("href", "#openrouter-integration")
  expect(screen.queryByText("Marketplace settings")).not.toBeInTheDocument()
  expect(screen.queryByText("Composio settings")).not.toBeInTheDocument()

  fireEvent.mouseDown(screen.getByRole("tab", { name: "layout.sidebar.integrations" }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Marketplace settings")).toBeInTheDocument()
  expect(screen.getByText("Composio settings")).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: /OpenRouter settings/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "OpenRouter" })).not.toBeInTheDocument()
})