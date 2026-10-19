import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useRouter, useSearchParams } from "next/navigation"
import { SocialSection } from "@/app/components/settings/SocialSection"
import { SupportChannelsSection } from "@/app/components/settings/SupportChannelsSection"
import SocialNetworkCallbackPage from "@/app/settings/social_network/page"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import type { Site } from "@/app/context/site-types"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { apiClient } from "@/app/services/api-client-service"
import type { ComponentProps } from "react"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/BillingLimitContext", () => ({ useBillingLimit: jest.fn() }))
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/components/settings/disconnect-remote-accounts", () => ({
  disconnectOutstandSocial: jest.fn(), disconnectZavuChannel: jest.fn(), shouldDeleteZavuSender: jest.fn(),
}))
jest.mock("@/app/components/settings/use-zavu-invitation-sync", () => ({
  useZavuInvitationSync: () => ({ checkStatus: jest.fn() }),
}))
jest.mock("@/app/components/settings/use-zavu-phone-status-sync", () => ({ useZavuPhoneStatusSync: jest.fn() }))
jest.mock("@/app/components/settings/use-zavu-sender-phone-numbers", () => ({
  useZavuSenderPhoneNumbers: () => ({}), getSenderPhoneNumberKey: () => "sender",
}))
jest.mock("@/app/components/settings/VoiceChannelSetup", () => ({ VoiceChannelSetup: () => <div>Voice setup</div> }))
jest.mock("@/app/components/settings/VoiceChannelSettings", () => ({ VoiceChannelSettings: () => null }))
jest.mock("@/app/components/settings/SmsChannelSetup", () => ({ SmsChannelSetup: () => <div>SMS setup</div> }))
jest.mock("@/app/components/settings/TelegramChannelSetup", () => ({ TelegramChannelSetup: () => <div>Telegram setup</div> }))
jest.mock("@/app/components/settings/EmailChannelSetup", () => ({ EmailChannelSetup: () => <div>Email setup</div> }))
jest.mock("@/app/components/settings/SocialAccountCard", () => ({
  SocialAccountCard: ({ canConnectAccount, index, onConnect, onOpenAccountLimit }: ComponentProps<
    typeof import("@/app/components/settings/SocialAccountCard").SocialAccountCard
  >) => <div>
    <output data-testid={`social-admission-${index}`}>{String(canConnectAccount)}</output>
    <button onClick={() => onConnect(index)}>Connect social {index}</button>
    <button onClick={onOpenAccountLimit}>Social limit {index}</button>
  </div>,
}))

const start = "2026-10-19T12:00:00.000Z"
const end = "2026-11-03T12:00:00.000Z"
interface TestBilling {
  plan: string
  addons_count: number
  trial_started_at: string
  trial_ends_at: string
  trial_converted_at: string | null
  trial_credits_available: number
}
const trialBilling: TestBilling = {
  plan: "commission", addons_count: 0, trial_started_at: start, trial_ends_at: end,
  trial_converted_at: null, trial_credits_available: 50,
}
const showBillingLimit = jest.fn()
const showBillingLimitFromError = jest.fn()
const siteHook = jest.mocked(useSite)
const fetchMock = jest.mocked(fetch)

function setSite({ social = 0, agent = 0, billing = trialBilling } = {}) {
  const site = {
    id: "site-1", billing,
    settings: {
      social_media: Array.from({ length: social }, () => ({ platform: "facebook", isActive: true })),
      channels: { connections: Array.from({ length: agent }, () => ({ type: "whatsapp", status: "connected" })) },
    },
  } as unknown as Site
  siteHook.mockReturnValue({ currentSite: site } as ReturnType<typeof useSite>)
  return site
}

function SettingsForm({ section, values }: { section: "social" | "support"; values?: Partial<SiteFormValues> }) {
  const form = useForm<SiteFormValues>({ defaultValues: {
    social_media: [{ platform: "facebook", isActive: false }],
    channels: { connections: [{ id: "pending-1", type: "whatsapp", name: "WhatsApp", status: "pending" }] },
    ...values,
  } as SiteFormValues })
  const watchedValues = useWatch({ control: form.control })
  return <FormProvider {...form}>
    {section === "social" ? <SocialSection active siteId="site-1" /> : <SupportChannelsSection active siteId="site-1" />}
    <output data-testid="form-values">{JSON.stringify(watchedValues)}</output>
  </FormProvider>
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Date, "now").mockReturnValue(Date.parse(start))
  jest.mocked(useBillingLimit).mockReturnValue({ showBillingLimit, showBillingLimitFromError })
  showBillingLimitFromError.mockReturnValue(false)
  setSite()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: false, error: "server limit" }) } as Response)
  jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} })
})

afterEach(() => { jest.restoreAllMocks() })

describe("social settings trial admission", () => {
  it("allows a sixth social account and the OAuth request without changing the Free plan", async () => {
    const site = setSite({ social: 5, agent: 3 })
    render(<SettingsForm section="social" />)
    expect(screen.getByTestId("social-admission-0")).toHaveTextContent("true")
    fireEvent.click(screen.getByRole("button", { name: "Add Social Network" }))
    expect(JSON.parse(screen.getByTestId("form-values").textContent || "{}").social_media).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Connect social 1" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/social/facebook/auth-url?siteId=site-1", expect.objectContaining({ method: "POST" }),
    ))
    expect(showBillingLimit).not.toHaveBeenCalled()
    expect(site.billing?.plan).toBe("commission")
  })

  it("blocks add/connect at trial capacity and consistently displays six plus add-ons", () => {
    setSite({ social: 7, agent: 3, billing: { ...trialBilling, addons_count: 1 } })
    render(<SettingsForm section="social" />)
    expect(screen.getByTestId("social-admission-0")).toHaveTextContent("false")
    for (const name of ["Add Social Network", "Connect social 0", "Social limit 0"]) {
      fireEvent.click(screen.getByRole("button", { name }))
    }
    expect(showBillingLimit).toHaveBeenCalledTimes(3)
    expect(showBillingLimit).toHaveBeenLastCalledWith({ kind: "accounts", current: 7, limit: 7 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["exact expiry", Date.parse(end), trialBilling, 1],
    ["future trial", Date.parse(start) - 1, trialBilling, 1],
    ["converted trial", Date.parse(start), { ...trialBilling, trial_converted_at: start }, 1],
    ["paid precedence", Date.parse(start), { ...trialBilling, plan: "engine" }, 3],
  ])("uses the base allowance for %s", (_label, now, billing, limit) => {
    jest.mocked(Date.now).mockReturnValue(now)
    setSite({ social: limit, billing })
    render(<SettingsForm section="social" />)
    fireEvent.click(screen.getByRole("button", { name: "Add Social Network" }))
    expect(showBillingLimit).toHaveBeenCalledWith({ kind: "accounts", current: limit, limit })
    expect(screen.getByTestId("social-admission-0")).toHaveTextContent("false")
  })
})

describe("support settings trial admission", () => {
  it("allows a third agent channel and the real invitation path", async () => {
    setSite({ social: 6, agent: 2 })
    render(<SettingsForm section="support" />)
    fireEvent.click(screen.getByRole("button", { name: "Add Channel" }))
    expect(JSON.parse(screen.getByTestId("form-values").textContent || "{}").channels.connections).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Connect Account" }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(
      "/api/integrations/zavu/invitations", expect.objectContaining({ siteId: "site-1", channelId: "pending-1" }),
    ))
    expect(showBillingLimit).not.toHaveBeenCalled()
  })

  it("blocks add/connect at trial capacity with the three plus add-ons allowance", () => {
    setSite({ social: 6, agent: 4, billing: { ...trialBilling, addons_count: 1 } })
    render(<SettingsForm section="support" />)
    fireEvent.click(screen.getByRole("button", { name: "Add Channel" }))
    fireEvent.click(screen.getByRole("button", { name: "Connect Account" }))
    expect(showBillingLimit).toHaveBeenCalledTimes(2)
    expect(showBillingLimit).toHaveBeenLastCalledWith({ kind: "accounts", current: 4, limit: 4 })
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it.each(["voice", "sms", "email", "telegram"])("admits %s setup only during the active trial", (type) => {
    render(<SettingsForm section="support" values={{ channels: {
      connections: [{ id: "pending-1", type, name: type, status: "pending" }],
    } as SiteFormValues["channels"] }} />)
    expect(screen.getByText(new RegExp(`^${type} setup$`, "i"))).toBeInTheDocument()
    jest.mocked(Date.now).mockReturnValue(Date.parse(end))
    fireEvent.click(screen.getByRole("button", { name: "Add Channel" }))
    expect(showBillingLimit).toHaveBeenCalledWith({ kind: "accounts", current: 0, limit: 0 })
  })

  it("shows upgrade instead of setup after exact expiry", () => {
    jest.mocked(Date.now).mockReturnValue(Date.parse(end))
    render(<SettingsForm section="support" values={{ channels: {
      connections: [{ id: "voice-1", type: "voice", name: "Voice", status: "pending" }],
    } as SiteFormValues["channels"] }} />)
    expect(screen.queryByText("Voice setup")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to connect" }))
    expect(showBillingLimit).toHaveBeenCalledWith({ kind: "accounts", current: 0, limit: 0 })
  })
})

describe("social OAuth callback batch admission", () => {
  beforeEach(() => {
    const params = new URLSearchParams({ siteId: "site-1", network: "facebook", session: "test-session" })
    jest.mocked(useSearchParams).mockReturnValue(params as unknown as ReturnType<typeof useSearchParams>)
    jest.mocked(useRouter).mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
    fetchMock.mockImplementation(async (url) => ({
      ok: true,
      json: async () => String(url).endsWith("/finalize")
        ? { success: false, error: { code: "BILLING_LIMIT_EXCEEDED" } }
        : { success: true, data: { availablePages: [{ id: "page-1", name: "Page One" }, { id: "page-2", name: "Page Two" }] } },
    } as Response))
    showBillingLimitFromError.mockReturnValue(true)
  })

  it("admits both selected pages within Foundry capacity and retains server rejection handling", async () => {
    setSite({ social: 4, agent: 3 })
    render(<SocialNetworkCallbackPage />)
    fireEvent.click(await screen.findByRole("button", { name: "Connect 2 Page(s)" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/social/accounts/pending/test-session/finalize", expect.objectContaining({
        method: "POST", body: JSON.stringify({ accountIds: ["page-1", "page-2"], selectedPageIds: ["page-1", "page-2"], siteId: "site-1", network: "facebook" }),
      }),
    ))
    await waitFor(() => expect(showBillingLimitFromError).toHaveBeenCalled())
    expect(showBillingLimit).not.toHaveBeenCalled()
  })

  it.each([
    ["trial batch overflow", Date.parse(start), 5, trialBilling, 6],
    ["expired trial", Date.parse(end), 0, trialBilling, 1],
    ["paid precedence", Date.parse(start), 2, { ...trialBilling, plan: "engine" }, 3],
  ])("blocks %s before finalize with the full selected count", async (_label, now, social, billing, limit) => {
    jest.mocked(Date.now).mockReturnValue(now)
    setSite({ social, billing })
    render(<SocialNetworkCallbackPage />)
    fireEvent.click(await screen.findByRole("button", { name: "Connect 2 Page(s)" }))
    expect(showBillingLimit).toHaveBeenCalledWith({ kind: "accounts", current: social + 2, limit })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})