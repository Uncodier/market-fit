import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import {
  SupportChannelsSection,
} from "@/app/components/settings/SupportChannelsSection"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { apiClient } from "@/app/services/api-client-service"

const canonicalConnections = [{
  id: "voice-1",
  type: "voice",
  name: "Voice",
  status: "pending",
  zavu_sender_id: "sender_new",
  metadata: { activation_pending: true },
}, {
  id: "sms-1",
  type: "sms",
  name: "SMS",
  status: "connected",
  zavu_sender_id: "sender_new",
  metadata: { phone_number: "+14155550102" },
}]

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    currentSite: {
      id: "site-1",
      billing: { plan: "pro", addons_count: 0 },
    },
  }),
}))
jest.mock("@/app/context/BillingLimitContext", () => ({
  useBillingLimit: () => ({
    showBillingLimit: jest.fn(),
    showBillingLimitFromError: jest.fn(),
  }),
}))
jest.mock("@/lib/billing-limits", () => ({
  countAgentChannels: () => 1,
  getAgentChannelLimit: () => 10,
  canConnectAgentChannel: () => true,
}))
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}))
jest.mock("@/app/components/settings/use-zavu-invitation-sync", () => ({
  useZavuInvitationSync: () => ({ checkStatus: jest.fn() }),
}))
jest.mock("@/app/components/settings/use-zavu-phone-status-sync", () => ({
  useZavuPhoneStatusSync: jest.fn(),
}))
jest.mock("@/app/components/settings/VoiceChannelSetup", () => ({
  VoiceChannelSetup: ({ onConnected }: { onConnected: (payload: unknown) => void }) => (
    <button
      type="button"
      onClick={() => onConnected({ connections: canonicalConnections })}
    >
      Complete Voice setup
    </button>
  ),
}))
jest.mock("@/app/components/settings/SmsChannelSetup", () => ({
  SmsChannelSetup: () => null,
}))
jest.mock("@/app/components/settings/TelegramChannelSetup", () => ({
  TelegramChannelSetup: () => null,
}))
jest.mock("@/app/components/settings/EmailChannelSetup", () => ({
  EmailChannelSetup: () => null,
}))

function TestForm({
  onSave,
  initialConnections,
}: {
  onSave: jest.Mock
  initialConnections?: SiteFormValues["channels"]["connections"]
}) {
  const form = useForm<SiteFormValues>({
    defaultValues: {
      channels: {
        connections: initialConnections || [{
          id: "voice-1",
          type: "voice",
          name: "Voice",
          status: "pending",
          zavu_sender_id: "sender_old",
        }],
      },
    } as SiteFormValues,
  })
  const connections = form.watch("channels.connections")

  return (
    <FormProvider {...form}>
      <SupportChannelsSection active siteId="site-1" onSave={onSave} />
      <output data-testid="connections">{JSON.stringify(connections)}</output>
    </FormProvider>
  )
}

describe("SupportChannelsSection", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("adopts the backend connection snapshot without resaving stale form data", async () => {
    const onSave = jest.fn()
    render(<TestForm onSave={onSave} />)

    fireEvent.click(screen.getByRole("button", { name: "Complete Voice setup" }))

    await waitFor(() => {
      expect(screen.getByTestId("connections")).toHaveTextContent("sender_new")
      expect(screen.getByTestId("connections")).toHaveTextContent(
        '"activation_pending":true'
      )
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  it("shows assigned numbers for connected WhatsApp, Voice, and SMS cards", async () => {
    const getSpy = jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: {
        sender: {
          phoneNumber: "+14155550100",
          whatsapp: { displayPhoneNumber: "+14155550101" },
        },
      },
    })

    render(
      <TestForm
        onSave={jest.fn()}
        initialConnections={[{
          id: "whatsapp-1",
          type: "whatsapp",
          name: "WhatsApp",
          status: "connected",
          zavu_sender_id: "sender-whatsapp",
        }, {
          id: "voice-1",
          type: "voice",
          name: "Voice / Audio Agent",
          status: "connected",
          metadata: { phone_number: "+14155550102" },
        }, {
          id: "sms-1",
          type: "sms",
          name: "SMS",
          status: "connected",
          metadata: { routing: { phone_number: "+14155550103" } },
        }]}
      />
    )

    expect(screen.getByText("+1 (415) 555-0102")).toBeInTheDocument()
    expect(screen.getByText("+1 (415) 555-0103")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText("+1 (415) 555-0101")).toBeInTheDocument()
    })
    expect(getSpy).toHaveBeenCalledWith(
      "/api/integrations/zavu/senders/sender-whatsapp"
    )
  })
})
