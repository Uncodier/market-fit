import type { SupportedLocale } from "@/app/context/locale-preferences"

/** Native language labels remain recognizable regardless of the selected locale. */
export const COMMERCE_LOCALES: { value: SupportedLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
]