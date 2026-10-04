export const SPEECH_VOICE_VALUES = [
  "auto", "alloy", "echo", "fable", "onyx", "nova", "shimmer",
] as const

export const SPEECH_LANGUAGE_VALUES = [
  "auto", "en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko",
  "ar", "hi", "ru", "nl", "pl", "tr", "sv", "id", "uk", "vi",
] as const

export type SpeechVoice = typeof SPEECH_VOICE_VALUES[number]
export type SpeechLanguage = typeof SPEECH_LANGUAGE_VALUES[number]

export const SPEECH_VOICE_LABELS: Record<SpeechVoice, string> = {
  auto: "Auto (agent chooses)",
  alloy: "Alloy",
  echo: "Echo",
  fable: "Fable",
  onyx: "Onyx",
  nova: "Nova",
  shimmer: "Shimmer",
}

export const SPEECH_LANGUAGE_LABELS: Record<SpeechLanguage, string> = {
  auto: "Auto (agent chooses)",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  sv: "Swedish",
  id: "Indonesian",
  uk: "Ukrainian",
  vi: "Vietnamese",
}

export function normalizeSpeechVoice(value: unknown): SpeechVoice {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return SPEECH_VOICE_VALUES.find((voice) => voice === normalized) ?? "auto"
}

export function normalizeSpeechLanguage(value: unknown): SpeechLanguage {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  return SPEECH_LANGUAGE_VALUES.find((language) => language === normalized) ?? "auto"
}