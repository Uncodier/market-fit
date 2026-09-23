import {
  filterVoicesByLanguage,
  getVoiceOptionLabel,
  readVoiceAgentSettings,
  retainCompatibleVoice,
} from "@/app/components/settings/voice-agent-settings"
import { canManageVoiceChannel } from "@/app/components/settings/use-can-manage-voice-channel"

const voices = [
  { id: "voice-en", name: "thalia", language: "en" },
  { id: "voice-es", name: "celeste", language: "es" },
]

describe("Voice agent settings", () => {
  it("reads persisted settings and defaults new channels to automatic", () => {
    expect(readVoiceAgentSettings({ metadata: {
      voice_language: "es",
      tts_voice_id: "voice-es",
    } })).toEqual({
      language: "es",
      ttsVoiceId: "voice-es",
    })
    expect(readVoiceAgentSettings({})).toEqual({
      language: "auto",
      ttsVoiceId: "",
    })
  })

  it("filters voices and clears one that does not support a new language", () => {
    expect(filterVoicesByLanguage(voices, "es")).toEqual([voices[1]])
    expect(filterVoicesByLanguage(voices, "auto")).toEqual(voices)
    expect(retainCompatibleVoice(voices, "es", "voice-en")).toBe("")
    expect(retainCompatibleVoice(voices, "auto", "voice-en")).toBe("voice-en")
  })

  it("formats provider voice names for the selector", () => {
    expect(getVoiceOptionLabel(voices[1])).toContain("Celeste")
    expect(getVoiceOptionLabel(voices[1])).toContain("Spanish")
  })

  it("limits Voice configuration to site owners and administrators", () => {
    const capabilities = {
      is_owner: false,
      select: true,
      insert: true,
      update: true,
      delete: true,
    } as const

    expect(canManageVoiceChannel({ ...capabilities, role: "admin" })).toBe(true)
    expect(canManageVoiceChannel({ ...capabilities, role: "collaborator" })).toBe(false)
    expect(canManageVoiceChannel({ ...capabilities, role: "marketing" })).toBe(false)
    expect(canManageVoiceChannel({ ...capabilities, role: "owner" })).toBe(true)
  })
})
