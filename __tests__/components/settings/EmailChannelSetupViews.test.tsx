import { render, screen } from "@testing-library/react"
import { EmailInboundSettings } from "@/app/components/settings/EmailChannelSetupViews"

const baseProps = {
  domain: "mail.example.com",
  copied: null,
  isMxVerified: true,
  isVerifyingMx: false,
  isProcessing: false,
  isSyncingCloudflare: false,
  isCloudflareConnected: true,
  isChannelActive: true,
  isActivating: false,
  receivingEnabled: true,
  hasReceivingChanges: false,
  onCopy: jest.fn(),
  onReceivingChange: jest.fn(),
  onSync: jest.fn(),
  onVerify: jest.fn(),
  onSave: jest.fn(),
  onActivate: jest.fn(),
}

describe("EmailInboundSettings", () => {
  it("hides completed MX setup controls", () => {
    render(<EmailInboundSettings {...baseProps} isMxConfigured />)

    expect(screen.getByText("Verified")).toBeInTheDocument()
    expect(screen.queryByText(/MX 10 inbound\.zavu\.dev/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sync with Cloudflare" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Verify MX" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save Changes" })).not.toBeInTheDocument()
  })

  it("keeps save available when the receiving setting changes", () => {
    render(
      <EmailInboundSettings
        {...baseProps}
        isMxConfigured
        receivingEnabled={false}
        hasReceivingChanges
      />
    )

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Verify MX" })).not.toBeInTheDocument()
  })

  it("shows activation as the final step after MX verification", () => {
    render(
      <EmailInboundSettings
        {...baseProps}
        isMxConfigured
        isChannelActive={false}
      />
    )

    expect(screen.getByText(/Final step: activate this connection/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Activate Email Channel" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Verify MX" })).not.toBeInTheDocument()
  })
})
