import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { VoiceChannelSetup } from "@/app/components/settings/VoiceChannelSetup"
import { apiClient } from "@/app/services/api-client-service"

jest.mock("@/app/components/settings/VoiceAgentSettingsFields", () => ({
  VoiceAgentSettingsFields: ({ value, onChange }: {
    value: { language: string; ttsVoiceId: string }
    onChange: (value: { language: string; ttsVoiceId: string }) => void
  }) => (
    <>
      <output data-testid="setup-voice-value">{`${value.language}:${value.ttsVoiceId}`}</output>
      <button
        type="button"
        onClick={() => onChange({ language: "es", ttsVoiceId: "voice-es" })}
      >
        Configure Spanish voice
      </button>
    </>
  ),
}))

describe("VoiceChannelSetup", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("includes the selected language and voice when activating a number", async () => {
    jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: "phone-1",
          phoneNumber: "+14155550100",
          capabilities: ["voice"],
          status: "active",
          regulatoryStatus: "approved",
          senderId: "sender-1",
        }],
      },
    })
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      data: {
        senderId: "sender-1",
        agentEnabled: true,
        regulatoryStatus: "approved",
        connections: [{
          id: "voice-1",
          type: "voice",
          status: "connected",
          zavu_sender_id: "sender-1",
        }],
      },
    })

    render(
      <VoiceChannelSetup
        siteId="site-1"
        channel={{ id: "voice-1", name: "Voice Support", metadata: {} }}
        onConnected={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Configure Spanish voice" }))
    fireEvent.click(await screen.findByText("+1 (415) 555-0100"))
    fireEvent.click(screen.getByRole("button", { name: "Activate Voice Agent" }))

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith("/api/integrations/zavu/voice", {
        siteId: "site-1",
        channelId: "voice-1",
        name: "Voice Support",
        phoneNumber: "+14155550100",
        active: true,
        language: "es",
        ttsVoiceId: "voice-es",
      })
    })
  })

  it("does not overwrite canonical agent preferences when adding a line", async () => {
    jest.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
      if (path.includes("/voice/options")) {
        return {
          success: true,
          data: {
            items: [],
            languages: ["auto", "es"],
            preferences: { language: "es", ttsVoiceId: "voice-es" },
          },
        }
      }
      return {
        success: true,
        data: {
          items: [{
            id: "phone-1",
            phoneNumber: "+14155550100",
            capabilities: ["voice"],
            status: "active",
            regulatoryStatus: "approved",
            senderId: "sender-1",
          }],
        },
      }
    })
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({
      success: true,
      data: {
        senderId: "sender-1",
        agentEnabled: true,
        regulatoryStatus: "approved",
        connections: [{ id: "voice-2", type: "voice", status: "connected" }],
      },
    })

    render(
      <VoiceChannelSetup
        siteId="site-canonical"
        channel={{ id: "voice-2", name: "Second Voice Line", metadata: {} }}
        onConnected={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId("setup-voice-value")).toHaveTextContent("es:voice-es")
    })
    fireEvent.click(await screen.findByText("+1 (415) 555-0100"))
    fireEvent.click(screen.getByRole("button", { name: "Activate Voice Agent" }))

    await waitFor(() => {
      expect(post).toHaveBeenCalled()
    })
    const payload = post.mock.calls[0][1] as Record<string, unknown>
    expect(payload).not.toHaveProperty("language")
    expect(payload).not.toHaveProperty("ttsVoiceId")
  })
})
