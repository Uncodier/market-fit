export const AUTO_VOICE_LANGUAGE = "auto"

export interface VoiceOption {
  id: string
  name: string
  language: string
}

export interface VoiceOptionsResponse {
  items: VoiceOption[]
  languages: string[]
  total?: number
  preferences?: {
    language: string
    ttsVoiceId?: string
  }
}

export interface VoiceAgentSettingsValue {
  language: string
  ttsVoiceId: string
}

export function readVoiceAgentSettings(channel: any): VoiceAgentSettingsValue {
  return {
    language:
      typeof channel?.metadata?.voice_language === "string"
        ? channel.metadata.voice_language
        : AUTO_VOICE_LANGUAGE,
    ttsVoiceId:
      typeof channel?.metadata?.tts_voice_id === "string"
        ? channel.metadata.tts_voice_id
        : "",
  }
}

export function filterVoicesByLanguage(
  voices: VoiceOption[],
  language: string
): VoiceOption[] {
  if (language === AUTO_VOICE_LANGUAGE) return voices
  return voices.filter((voice) => voice.language === language)
}

export function retainCompatibleVoice(
  voices: VoiceOption[],
  language: string,
  ttsVoiceId: string
): string {
  if (!ttsVoiceId || language === AUTO_VOICE_LANGUAGE) return ttsVoiceId
  const selected = voices.find((voice) => voice.id === ttsVoiceId)
  return selected?.language === language ? ttsVoiceId : ""
}

export function getVoiceLanguageLabel(language: string): string {
  if (language === AUTO_VOICE_LANGUAGE) return "Automatic"
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language
  } catch {
    return language
  }
}

export function getVoiceOptionLabel(voice: VoiceOption): string {
  const name = voice.name
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
  return `${name || voice.id} · ${getVoiceLanguageLabel(voice.language)}`
}
