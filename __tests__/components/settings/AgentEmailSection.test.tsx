import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { AgentEmailSection } from "@/app/components/settings/AgentEmailSection"
import { resolveAgentEmailStage } from "@/app/components/settings/agentmail-settings"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { useSite } from "@/app/context/SiteContext"
import { apiClient } from "@/app/services/api-client-service"
import { secretsService } from "@/app/services/secrets-service"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: { getApiUrl: () => "https://api.example.com", post: jest.fn() },
}))
jest.mock("@/app/services/secrets-service", () => ({
  secretsService: { checkSecretExists: jest.fn(), storeSecret: jest.fn() },
}))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

type Status = "not_configured" | "pending" | "waiting_for_verification" | "active"

function setup(status: Status, setupRequested = false) {
  const agentEmail = {
    domain: "custom" as const,
    customDomain: "example.com",
    username: "support",
    displayName: "Support",
    status,
    setupRequested,
    domain_id: "domain-1",
    dns_records: [{ type: "TXT", name: "example.com", value: "verification" }],
  }
  ;(useSite as jest.Mock).mockReturnValue({
    currentSite: { id: "site-1", settings: { channels: { agent_email: agentEmail } } },
    updateSettings: jest.fn().mockResolvedValue(undefined),
  })
  function Harness() {
    const form = useForm<SiteFormValues>({
      defaultValues: { channels: { agent_email: agentEmail } },
    })
    return (
      <FormProvider {...form}>
        <AgentEmailSection active siteId="site-1" />
      </FormProvider>
    )
  }
  return render(<Harness />)
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(secretsService.checkSecretExists).mockResolvedValue(false)
  jest.mocked(secretsService.storeSecret).mockResolvedValue(true)
  jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} })
})

describe("Agent email integration stages", () => {
  it.each([
    ["active", true, "active"],
    ["waiting_for_verification", true, "waiting_for_verification"],
    ["pending", false, "pending"],
    ["requested", false, "pending"],
    ["not_configured", true, "pending"],
    [undefined, false, "not_configured"],
  ])("resolves %s with request flag %s as %s", (status, requested, expected) => {
    expect(resolveAgentEmailStage(status, requested)).toBe(expected)
  })

  it("focuses on DNS without showing the pending banner or a generic save action", async () => {
    setup("waiting_for_verification", true)
    expect(screen.getByText("2. Configure DNS Records")).toBeVisible()
    expect(screen.queryByText("Agent email request submitted")).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Setup progress" })).toBeVisible()
    expect(screen.getByText("Verify DNS", { selector: "span" }).closest("li")).toHaveAttribute("aria-current", "step")
    expect(screen.getByText("verification")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Request Agent Email" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("AgentMail API key")).not.toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Verify DNS" }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      "/api/integrations/agentmail/domains/domain-1/verify", {},
    ))
    expect(await screen.findByRole("button", { name: "Verify again in 5:00" })).toBeDisabled()
  })

  it("copies inline DNS records using the same view as agent channel settings", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    setup("waiting_for_verification", true)
    fireEvent.click(screen.getByRole("button", { name: "Copy DNS value 1" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("verification"))
  })

  it("shows only the processing stage for legacy requests", async () => {
    setup("not_configured", true)
    expect(screen.getByText("Agent email request submitted")).toBeVisible()
    expect(screen.queryByRole("button", { name: "Request Agent Email" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Verify DNS" })).not.toBeInTheDocument()
    await waitFor(() => expect(secretsService.checkSecretExists).toHaveBeenCalled())
  })

  it("shows the active address without stale setup actions", async () => {
    setup("active", true)
    expect(screen.getByText("Agent email active")).toBeVisible()
    expect(screen.getByText("support@example.com")).toBeVisible()
    expect(screen.getByRole("button", { name: "Delete Inbox" })).toBeVisible()
    expect(screen.queryByText("Agent email request submitted")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Verify DNS" })).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Setup progress" })).not.toBeInTheDocument()
    await waitFor(() => expect(secretsService.checkSecretExists).toHaveBeenCalled())
  })

  it("offers the initial request and saves optional credentials before creating an inbox", async () => {
    setup("not_configured")
    await waitFor(() => expect(secretsService.checkSecretExists).toHaveBeenCalled())
    fireEvent.click(screen.getByText("Advanced: AgentMail credentials & webhooks"))
    fireEvent.change(screen.getByLabelText("AgentMail API key"), {
      target: { value: "am_live_test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Request Agent Email" }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      "/api/integrations/agentmail/inbox/create", expect.objectContaining({ username: "support" }),
    ))
    expect(secretsService.storeSecret).toHaveBeenCalled()
    expect(jest.mocked(secretsService.storeSecret).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(apiClient.post).mock.invocationCallOrder[0],
    )
  })

  it("saves credentials separately without submitting an inbox request", async () => {
    setup("waiting_for_verification", true)
    await waitFor(() => expect(secretsService.checkSecretExists).toHaveBeenCalled())
    fireEvent.click(screen.getByText("Advanced: AgentMail credentials & webhooks"))
    fireEvent.change(screen.getByLabelText("AgentMail API key"), {
      target: { value: "am_live_test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save credentials" }))
    await waitFor(() => expect(secretsService.storeSecret).toHaveBeenCalled())
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it("does not create an inbox when pending credentials cannot be saved", async () => {
    jest.mocked(secretsService.storeSecret).mockResolvedValue(false)
    setup("not_configured")
    await waitFor(() => expect(secretsService.checkSecretExists).toHaveBeenCalled())
    fireEvent.click(screen.getByText("Advanced: AgentMail credentials & webhooks"))
    fireEvent.change(screen.getByLabelText("AgentMail API key"), {
      target: { value: "am_live_test" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Request Agent Email" }))
    await waitFor(() => expect(secretsService.storeSecret).toHaveBeenCalled())
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(screen.getByLabelText("AgentMail API key")).toHaveValue("am_live_test")
  })
})