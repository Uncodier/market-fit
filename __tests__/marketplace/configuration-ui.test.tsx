/** @jest-environment jsdom */
import "@testing-library/jest-dom"
import { randomBytes, randomUUID } from "node:crypto"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MarketplaceConfigurationCards } from "@/app/integrations/components/MarketplaceConfigurationCards"
import { toast } from "sonner"

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/components/ui/icons", () => ({ Copy: () => <span />, ChevronDown: () => <span /> }))
const siteId = randomUUID(), locationId = randomUUID()
const integration = { id: randomUUID(), site_id: siteId, provider: "rappi", environment: "sandbox", country: "MX",
  external_store_id: "store-14", origin_location_id: locationId, enabled: false, manual_ready: false,
  has_credentials: { client_id: true, client_secret: true, webhook_secret: true }, webhook_url: "https://app.example.test/api/marketplace/webhooks/rappi" }
const data = { integrations: [integration], locations: [{ id: locationId, name: "Main kitchen" }], can_manage: true }
const fetchMock = jest.fn()
function openAdvanced(container: HTMLElement) {
  container.querySelectorAll("details").forEach(element => {
    element.open = true
    fireEvent(element, new Event("toggle"))
  })
}

describe("native marketplace configuration cards", () => {
  beforeEach(() => {
    jest.clearAllMocks(); fetchMock.mockReset()
    global.fetch = jest.fn((url, options) => String(url).includes("merchant-connections")
      ? Promise.resolve({ ok: true, json: async () => ({ connections: [] }) }) : fetchMock(url, options)) as unknown as typeof fetch
    window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  })
  it("renders native provider cards with external onboarding warnings and write-only saved fields", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => data })
    const { container } = render(<MarketplaceConfigurationCards siteId={siteId} />)
    await screen.findByText("Uber Eats")
    openAdvanced(container)
    expect(screen.getAllByText(/Enabling the receiver does not connect or provision/)).toHaveLength(2)
    expect(screen.getByText(/one primary webhook URL per app/)).toBeInTheDocument()
    const rappi = container.querySelector("#marketplace-rappi")!
    for (const label of ["Client ID", "Client secret", "Webhook secret"]) {
      expect(within(rappi as HTMLElement).getByLabelText(label)).toHaveValue("")
      expect(within(rappi as HTMLElement).getByLabelText(label)).toHaveAttribute("type", "password")
    }
    expect(within(rappi as HTMLElement).getByLabelText("Provider webhook URL")).toHaveValue(integration.webhook_url)
    expect(screen.queryByText("Connected")).not.toBeInTheDocument()
  })
  it("preserves blank saved credentials, submits explicit ready configuration and clears replacements after success", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => data })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ integration: { ...integration, manual_ready: true } }) })
    const { container } = render(<MarketplaceConfigurationCards siteId={siteId} />)
    await screen.findByText("Uber Eats")
    openAdvanced(container)
    const rappi = container.querySelector("#marketplace-rappi") as HTMLElement
    const secret = randomBytes(24).toString("hex")
    fireEvent.change(within(rappi).getByLabelText("Client secret"), { target: { value: secret } })
    fireEvent.click(within(rappi).getByLabelText(/Rappi has enabled manual ready/))
    const save = within(rappi).getByRole("button", { name: "Save configuration" })
    expect(save).toHaveAttribute("form", rappi.querySelector("form")!.id)
    expect(save.closest("form")).toBeNull()
    expect(save.closest("div.border-t")).toHaveClass("justify-end")
    fireEvent.click(save)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, request] = fetchMock.mock.calls[1]
    expect(url).toBe("/api/marketplace/integrations")
    const body = JSON.parse(request.body)
    expect(body).toMatchObject({ siteId, integrationId: integration.id, manual_ready: true, client_secret: secret })
    expect(body).not.toHaveProperty("client_id")
    expect(body).not.toHaveProperty("webhook_secret")
    await waitFor(() => expect(within(rappi).getByLabelText("Client secret")).toHaveValue(""))
    expect(container.innerHTML).not.toContain(secret)
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("onboarding"))
  })
  it("disables writes for members and fails closed when configuration loading fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ...data, can_manage: false }) })
    const view = render(<MarketplaceConfigurationCards siteId={siteId} />)
    await screen.findByText("Uber Eats")
    openAdvanced(view.container)
    expect(screen.getAllByRole("button", { name: "Save configuration" }).every(button => button.hasAttribute("disabled"))).toBe(true)
    expect(screen.queryByRole("button", { name: "Add store" })).not.toBeInTheDocument()
    view.unmount()
    fetchMock.mockRejectedValueOnce(new Error("Offline"))
    render(<MarketplaceConfigurationCards siteId={siteId} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load marketplace configuration")
    expect(screen.queryByRole("button", { name: "Save configuration" })).not.toBeInTheDocument()
  })
  it("does not render another site's saved configuration during a site switch", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => data })
    const view = render(<MarketplaceConfigurationCards siteId={siteId} />)
    await screen.findByText("Uber Eats")
    fetchMock.mockImplementationOnce(() => new Promise(() => {}))
    view.rerender(<MarketplaceConfigurationCards siteId={randomUUID()} />)
    expect(screen.queryByText("Uber Eats")).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue(integration.external_store_id)).not.toBeInTheDocument()
  })
  it("uses the provider card footer for outline actions and switches to Save only when Advanced is open", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => data })
    const { container } = render(<MarketplaceConfigurationCards siteId={siteId} />)
    await screen.findByText("Uber Eats")
    for (const provider of ["rappi", "uber_eats"]) {
      const card = container.querySelector(`#marketplace-${provider}`) as HTMLElement
      const authorize = within(card).getByRole("button", { name: /Authorize/ })
      expect(authorize.closest("div.border-t")).toBe(card.lastElementChild)
      expect(authorize).toHaveClass("ring-input")
      expect(authorize).not.toHaveClass("btn-primary")
      expect(within(card).queryByRole("button", { name: "Save configuration" })).not.toBeInTheDocument()
      const advanced = card.querySelector("details")!
      advanced.open = true
      fireEvent(advanced, new Event("toggle"))
      expect(within(card).getByRole("button", { name: "Save configuration" }).closest("div.border-t")).toBe(card.lastElementChild)
      expect(within(card).queryByRole("button", { name: /Authorize/ })).not.toBeInTheDocument()
      advanced.open = false
      fireEvent(advanced, new Event("toggle"))
      expect(within(card).getByRole("button", { name: /Authorize/ })).toBeInTheDocument()
    }
  })
})