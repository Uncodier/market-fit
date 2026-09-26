import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EmailChannelSetup } from "@/app/components/settings/EmailChannelSetup"

const postMock = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    get: jest.fn(),
    post: (...args: unknown[]) => postMock(...args),
  },
}))
jest.mock("@/app/services/secrets-service", () => ({
  secretsService: { checkSecretExists: jest.fn().mockResolvedValue(false) },
}))
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe("EmailChannelSetup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, verified: true }),
    })
  })

  it("immediately reconciles the domain returned by a manual MX recheck", async () => {
    postMock.mockResolvedValue({
      success: true,
      data: {
        domain: {
          id: "domain_1",
          status: "verified",
          dnsRecords: [{ type: "MX", value: "inbound-smtp.us-east-1.amazonaws.com" }],
        },
      },
    })
    const onUpdated = jest.fn().mockResolvedValue(undefined)
    const channel = {
      id: "channel_1",
      status: "connected",
      zavu_sender_id: "sender_1",
      metadata: {
        domain: "mail.example.com",
        domain_status: "verified",
        email_domain_id: "domain_1",
        emailChannelActive: true,
        emailReceivingEnabled: true,
        dns_records: [{ type: "TXT" }],
      },
    }

    render(<EmailChannelSetup siteId="site_1" channel={channel} onUpdated={onUpdated} />)
    fireEvent.click(screen.getByRole("button", { name: "Recheck MX" }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({
      status: "connected",
      metadata: {
        ...channel.metadata,
        domain_status: "verified",
        dns_records: [{ type: "MX", value: "inbound-smtp.us-east-1.amazonaws.com" }],
      },
    }))
    expect(postMock).toHaveBeenCalledWith(
      "/api/integrations/zavu/email-domains/domain_1/verify",
      { siteId: "site_1", channelId: "channel_1" }
    )
  })

  it("reconciles a manual recheck that remains pending in Zavu", async () => {
    postMock.mockResolvedValue({
      success: true,
      data: { domain: { id: "domain_1", status: "pending", dnsRecords: [{ type: "MX" }] } },
    })
    const onUpdated = jest.fn().mockResolvedValue(undefined)
    const channel = {
      id: "channel_1",
      zavu_sender_id: "sender_1",
      metadata: {
        domain: "mail.example.com",
        domain_status: "verified",
        email_domain_id: "domain_1",
        emailChannelActive: true,
        emailReceivingEnabled: true,
      },
    }

    render(<EmailChannelSetup siteId="site_1" channel={channel} onUpdated={onUpdated} />)
    fireEvent.click(screen.getByRole("button", { name: "Recheck MX" }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({
      status: "connected",
      metadata: {
        ...channel.metadata,
        domain_status: "pending",
        dns_records: [{ type: "MX" }],
      },
    }))
  })
})