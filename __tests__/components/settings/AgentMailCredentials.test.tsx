import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AgentMailCredentials } from "@/app/components/settings/AgentMailCredentials"
import { buildAgentMailWebhookUrl } from "@/app/components/settings/agentmail-settings"
import { useAgentMailSecrets } from "@/app/components/settings/use-agentmail-secrets"
import { secretsService } from "@/app/services/secrets-service"

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

jest.mock("@/app/services/secrets-service", () => ({
  secretsService: {
    checkSecretExists: jest.fn(),
    storeSecret: jest.fn(),
    deleteSecret: jest.fn(),
  },
}))

const mockedSecretsService = secretsService as jest.Mocked<typeof secretsService>

function CredentialsHarness() {
  const secrets = useAgentMailSecrets("site-1")
  const webhookUrl = buildAgentMailWebhookUrl("https://backend.example.com/")

  return (
    <>
      <AgentMailCredentials secrets={secrets} webhookUrl={webhookUrl} />
      <button type="button" onClick={() => void secrets.savePendingSecrets()}>
        Save credentials
      </button>
    </>
  )
}

describe("AgentMailCredentials", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedSecretsService.checkSecretExists.mockResolvedValue(false)
    mockedSecretsService.storeSecret.mockResolvedValue(true)
    mockedSecretsService.deleteSecret.mockResolvedValue(true)
  })

  it("stores the API key and webhook secret under separate Vault use cases", async () => {
    render(<CredentialsHarness />)

    await waitFor(() => {
      expect(mockedSecretsService.checkSecretExists).toHaveBeenCalledTimes(2)
    })

    fireEvent.change(screen.getByLabelText("AgentMail API key"), {
      target: { value: "am_live_test" },
    })
    fireEvent.change(screen.getByLabelText("AgentMail webhook signing secret"), {
      target: { value: "whsec_test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save credentials" }))

    await waitFor(() => {
      expect(mockedSecretsService.storeSecret).toHaveBeenCalledWith(
        "site-1",
        "agentmail",
        "integrations",
        "AgentMail API Key (BYOK)",
        "am_live_test",
      )
      expect(mockedSecretsService.storeSecret).toHaveBeenCalledWith(
        "site-1",
        "agentmail",
        "webhook",
        "AgentMail Webhook Signing Secret",
        "whsec_test",
      )
    })

    expect(await screen.findByText("Webhook secret is securely stored in Vault")).toBeVisible()
  })

  it("shows and copies the message.received webhook URL", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(<CredentialsHarness />)

    expect(screen.getByLabelText("AgentMail webhook URL")).toHaveValue(
      "https://backend.example.com/api/integrations/agentmail/webhook/message-received",
    )
    fireEvent.click(screen.getByRole("button", { name: "Copy AgentMail webhook URL" }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "https://backend.example.com/api/integrations/agentmail/webhook/message-received",
      )
    })
  })
})
