import { useState } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { EmailChannelSetup } from "@/app/components/settings/EmailChannelSetup"
import { toast } from "sonner"

const postMock = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: { get: jest.fn().mockResolvedValue({ success: false }), post: (...args: unknown[]) => postMock(...args) },
}))
jest.mock("@/app/services/secrets-service", () => ({
  secretsService: { checkSecretExists: jest.fn().mockResolvedValue(false) },
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const original = {
  id: "support", type: "email", status: "connected", zavu_sender_id: "support_sender",
  metadata: { domain: "example.com", email_domain_id: "domain_1", domain_status: "verified",
    from_address: "support@example.com", emailReceivingEnabled: true, emailChannelActive: true },
}
const domainResult = (status = "verified") => ({
  success: true, data: { reused: true, domain: { id: "domain_1", domain: "example.com", status, dnsRecords: [] } },
})

function Setup({ connections = [original], initialMetadata = {} }: {
  connections?: typeof original[]; initialMetadata?: Record<string, unknown>
}) {
  const [channel, setChannel] = useState({ id: "sales", name: "Sales", status: "pending", metadata: initialMetadata })
  return <EmailChannelSetup siteId="site_1" channel={channel} connections={connections}
    onUpdated={(payload) => { setChannel((current) => ({ ...current, ...payload })) }} />
}

describe("same-domain email setup", () => {
  beforeAll(() => { Element.prototype.scrollIntoView = jest.fn() })
  beforeEach(() => {
    jest.clearAllMocks()
    postMock.mockReset()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, verified: false }) })
  })

  it("skips DNS only after a fresh provider result and creates an independent sender", async () => {
    postMock.mockResolvedValueOnce(domainResult()).mockResolvedValueOnce({
      success: true, data: { senderId: "sales_sender", sender: { id: "sales_sender", channels: [] } },
    })
    render(<Setup />)
    expect(screen.getByRole("combobox", { name: "Email Domain" })).toHaveTextContent("example.com")
    expect(screen.queryByLabelText("From Address")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await screen.findByLabelText("From Address")
    expect(postMock).toHaveBeenNthCalledWith(1, "/api/integrations/zavu/email-domains", {
      domain: "example.com", siteId: "site_1", channelId: "sales", name: "Sales",
    })
    expect(screen.queryByRole("button", { name: "Verify DNS" })).not.toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Setup progress" })).getByText("Email Address").closest("li"))
      .toHaveAttribute("aria-current", "step")
    fireEvent.change(screen.getByLabelText("From Address"), { target: { value: " sales " } })
    fireEvent.change(screen.getByLabelText("From Name"), { target: { value: " Sales Team " } })
    fireEvent.click(screen.getByRole("button", { name: "Create Email Channel" }))
    await waitFor(() => expect(postMock).toHaveBeenNthCalledWith(2, "/api/integrations/zavu/channels/email", {
      siteId: "site_1", channelId: "sales", name: "Sales", emailAddress: "sales@example.com",
      emailFromName: "Sales Team", emailDomainId: "domain_1",
    }))
    expect(await screen.findByRole("switch")).not.toBeChecked()
    expect(original.metadata.emailReceivingEnabled).toBe(true)
    expect(original.zavu_sender_id).toBe("support_sender")
  })

  it("keeps DNS verification when a formerly verified domain is now pending", async () => {
    postMock.mockResolvedValue(domainResult("pending"))
    render(<Setup />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await screen.findByRole("button", { name: "Verify DNS" })
    expect(screen.queryByLabelText("From Address")).not.toBeInTheDocument()
    expect(screen.getByText(/records are shared by email addresses/)).toBeInTheDocument()
  })

  it("uses a pending existing domain once its fresh provider state is verified", async () => {
    postMock.mockResolvedValue(domainResult())
    render(<Setup connections={[{ ...original, metadata: { ...original.metadata, domain_status: "pending" } }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await screen.findByLabelText("From Address")
  })

  it("adds and verifies a new subdomain instead of inheriting its parent's status", async () => {
    postMock.mockResolvedValue({ success: true, data: { reused: false, domain: {
      id: "subdomain_1", domain: "agents.example.com", status: "pending", dnsRecords: [],
    } } })
    render(<Setup />)
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Email Domain" }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("option", { name: "Add a new domain or subdomain" }))
    fireEvent.change(screen.getByLabelText("New Domain or Subdomain"), { target: { value: " Agents.Example.COM. " } })
    fireEvent.click(screen.getByRole("button", { name: "Add Domain" }))
    await screen.findByRole("button", { name: "Verify DNS" })
    expect(postMock).toHaveBeenCalledWith("/api/integrations/zavu/email-domains", {
      domain: "agents.example.com", siteId: "site_1", channelId: "sales", name: "Sales",
    })
    expect(screen.queryByLabelText("From Address")).not.toBeInTheDocument()
  })

  it("detects a manually typed existing exact domain without trusting client metadata", async () => {
    postMock.mockResolvedValue(domainResult())
    render(<Setup />)
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Email Domain" }), { key: "Enter" })
    fireEvent.click(await screen.findByRole("option", { name: "Add a new domain or subdomain" }))
    fireEvent.change(screen.getByLabelText("New Domain or Subdomain"), { target: { value: " Example.COM. " } })
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await screen.findByLabelText("From Address")
    expect(postMock.mock.calls[0][1]).not.toHaveProperty("emailDomainId")
    expect(postMock.mock.calls[0][1]).not.toHaveProperty("domain_status")
  })

  it("keeps the selector retryable after a provider failure", async () => {
    postMock.mockResolvedValue({ success: false, error: { message: "Unable to check domain" } })
    render(<Setup />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Unable to check domain"))
    expect(screen.getByRole("button", { name: "Use Existing Domain" })).toBeEnabled()
    expect(screen.queryByLabelText("From Address")).not.toBeInTheDocument()
  })

  it("falls back to new-domain entry when the selected connection is removed", async () => {
    const { rerender } = render(<Setup />)
    rerender(<Setup connections={[]} />)
    expect(screen.getByLabelText("New Domain or Subdomain")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Domain" })).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()
    await act(async () => {})
  })

  it("omits blank channel names instead of blocking an unnamed email draft", async () => {
    postMock.mockResolvedValue(domainResult())
    const onUpdated = jest.fn()
    render(<EmailChannelSetup siteId="site_1" channel={{ id: "new", name: " " }} connections={[original]}
      onUpdated={onUpdated} />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(postMock).toHaveBeenCalledWith("/api/integrations/zavu/email-domains", {
      domain: "example.com", siteId: "site_1", channelId: "new",
    })
    expect(onUpdated.mock.calls[0][0]).not.toHaveProperty("status")
  })

  it("rejects a provider response for a different exact domain", async () => {
    postMock.mockResolvedValue({ success: true, data: { domain: {
      id: "other", domain: "other.example.com", status: "verified",
    } } })
    render(<Setup />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("did not match")))
    expect(screen.queryByLabelText("From Address")).not.toBeInTheDocument()
  })

  it("prevents duplicate submissions while checking the selected domain", async () => {
    let resolve!: (value: ReturnType<typeof domainResult>) => void
    postMock.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<Setup />)
    fireEvent.click(screen.getByRole("button", { name: "Use Existing Domain" }))
    expect(screen.getByRole("button", { name: "Checking domain..." })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Checking domain..." }))
    expect(postMock).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(domainResult()) })
    await screen.findByLabelText("From Address")
  })

  it("supports first-domain setup and blocks invalid domains", async () => {
    render(<Setup connections={[]} />)
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Domain" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("New Domain or Subdomain"), { target: { value: "https://example.com" } })
    expect(screen.getByRole("button", { name: "Add Domain" })).toBeDisabled()
    expect(postMock).not.toHaveBeenCalled()
    await act(async () => {})
  })

  it("blocks invalid from-address input and requires a nonblank sender name", async () => {
    render(<Setup initialMetadata={{ domain: "example.com", email_domain_id: "domain_1", domain_status: "verified" }} />)
    fireEvent.change(screen.getByLabelText("From Name"), { target: { value: " " } })
    expect(screen.getByRole("button", { name: "Create Email Channel" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("From Name"), { target: { value: "Sales" } })
    fireEvent.change(screen.getByLabelText("From Address"), { target: { value: "sales@example.com" } })
    expect(screen.getByRole("button", { name: "Create Email Channel" })).toBeDisabled()
    await act(async () => {})
  })
})