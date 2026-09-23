import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { VoiceChannelSettings } from "@/app/components/settings/VoiceChannelSettings"
import { apiClient } from "@/app/services/api-client-service"

jest.mock("@/app/components/settings/VoiceAgentSettingsFields", () => ({
  VoiceAgentSettingsFields: ({ value, onChange }: {
    value: { language: string; ttsVoiceId: string }
    onChange: (value: { language: string; ttsVoiceId: string }) => void
  }) => (
    <>
      <output data-testid="voice-draft">{`${value.language}:${value.ttsVoiceId}`}</output>
      <button
        type="button"
        onClick={() => onChange({ language: "es", ttsVoiceId: "voice-es" })}
      >
        Choose Spanish voice
      </button>
      <button
        type="button"
        onClick={() => onChange({ ...value, ttsVoiceId: "voice-en" })}
      >
        Change voice only
      </button>
    </>
  ),
}))

describe("VoiceChannelSettings", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("saves language and voice and forwards the canonical connection snapshot", async () => {
    const onUpdated = jest.fn()
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: {
        items: [],
        languages: ["auto", "es"],
        preferences: { language: "auto" },
      },
    })
    const patch = jest.spyOn(apiClient, "patch").mockResolvedValue({
      success: true,
      data: {
        connections: [{
          id: "voice-1",
          type: "voice",
          status: "connected",
          metadata: {
            voice_language: "es",
            tts_voice_id: "voice-es",
          },
        }],
      },
    })

    render(
      <VoiceChannelSettings
        siteId="site-1"
        channel={{
          id: "voice-1",
          metadata: { voice_language: "auto", tts_voice_id: null },
        }}
        onUpdated={onUpdated}
      />
    )

    await waitFor(() => expect(get).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Choose Spanish voice" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Voice Settings" }))

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("/api/integrations/zavu/voice", {
        siteId: "site-1",
        channelId: "voice-1",
        language: "es",
        ttsVoiceId: "voice-es",
      })
    })
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({
      connections: [expect.objectContaining({ id: "voice-1" })],
    }))
  })

  it("preserves a dirty draft across equivalent channel object replacements", async () => {
    const get = jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: {
        items: [],
        languages: ["auto", "es"],
        preferences: { language: "auto" },
      },
    })
    const props = {
      siteId: "site-draft",
      channel: {
        id: "voice-1",
        metadata: { voice_language: "auto", tts_voice_id: null },
      },
      onUpdated: jest.fn(),
    }
    const { rerender } = render(<VoiceChannelSettings {...props} />)

    await waitFor(() => expect(get).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Choose Spanish voice" }))
    expect(screen.getByTestId("voice-draft")).toHaveTextContent("es:voice-es")

    rerender(
      <VoiceChannelSettings
        {...props}
        channel={{ ...props.channel, metadata: { ...props.channel.metadata } }}
      />
    )

    expect(screen.getByTestId("voice-draft")).toHaveTextContent("es:voice-es")
  })

  it("sends only the preference field that changed", async () => {
    jest.spyOn(apiClient, "get").mockResolvedValue({
      success: true,
      data: {
        items: [],
        languages: ["auto", "en"],
        preferences: { language: "en", ttsVoiceId: "voice-old" },
      },
    })
    const patch = jest.spyOn(apiClient, "patch").mockResolvedValue({
      success: true,
      data: {
        voiceLanguage: "en",
        ttsVoiceId: "voice-en",
        connections: [{ id: "voice-1", type: "voice" }],
      },
    })

    render(
      <VoiceChannelSettings
        siteId="site-partial"
        channel={{
          id: "voice-1",
          metadata: { voice_language: "en", tts_voice_id: "voice-old" },
        }}
        onUpdated={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId("voice-draft")).toHaveTextContent("en:voice-old")
    })
    fireEvent.click(screen.getByRole("button", { name: "Change voice only" }))
    fireEvent.click(screen.getByRole("button", { name: "Save Voice Settings" }))

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("/api/integrations/zavu/voice", {
        siteId: "site-partial",
        channelId: "voice-1",
        ttsVoiceId: "voice-en",
      })
    })
  })
})
