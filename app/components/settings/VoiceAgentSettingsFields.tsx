"use client"

import { useId, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  AUTO_VOICE_LANGUAGE,
  filterVoicesByLanguage,
  getVoiceLanguageLabel,
  getVoiceOptionLabel,
  retainCompatibleVoice,
  type VoiceAgentSettingsValue,
  type VoiceOptionsResponse,
} from "./voice-agent-settings"

const DEFAULT_VOICE_VALUE = "__default_voice__"

export function VoiceAgentSettingsFields({
  value,
  onChange,
  options,
  onRetry,
  disabled = false,
}: {
  value: VoiceAgentSettingsValue
  onChange: (value: VoiceAgentSettingsValue) => void
  options: VoiceOptionsResponse & {
    isLoading: boolean
    error: string | null
  }
  onRetry?: () => void
  disabled?: boolean
}) {
  const languageId = useId()
  const voiceId = useId()
  const { items, languages, isLoading, error } = options
  const languageOptions = useMemo(
    () => Array.from(new Set([
      AUTO_VOICE_LANGUAGE,
      ...languages,
      ...(value.language !== AUTO_VOICE_LANGUAGE ? [value.language] : []),
    ])),
    [languages, value.language]
  )
  const compatibleVoices = filterVoicesByLanguage(items, value.language)
  const selectedVoiceAvailable = items.some(
    (voice) => voice.id === value.ttsVoiceId
  )

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={languageId}>Call language</Label>
          <Select
            value={value.language}
            disabled={disabled || isLoading}
            onValueChange={(language) => {
              onChange({
                language,
                ttsVoiceId: retainCompatibleVoice(
                  items,
                  language,
                  value.ttsVoiceId
                ),
              })
            }}
          >
            <SelectTrigger id={languageId} aria-label="Call language">
              <SelectValue placeholder={isLoading ? "Loading languages..." : "Select language"} />
            </SelectTrigger>
            <SelectContent>
              {languageOptions.map((language) => (
                <SelectItem key={language} value={language}>
                  {language === AUTO_VOICE_LANGUAGE
                    ? "Automatic (follow the caller)"
                    : getVoiceLanguageLabel(language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={voiceId}>Speaking voice</Label>
          <Select
            value={value.ttsVoiceId || DEFAULT_VOICE_VALUE}
            disabled={disabled || isLoading}
            onValueChange={(ttsVoiceId) => {
              onChange({
                ...value,
                ttsVoiceId:
                  ttsVoiceId === DEFAULT_VOICE_VALUE ? "" : ttsVoiceId,
              })
            }}
          >
            <SelectTrigger id={voiceId} aria-label="Speaking voice">
              <SelectValue placeholder={isLoading ? "Loading voices..." : "Select voice"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_VOICE_VALUE}>
                Automatic default
              </SelectItem>
              {value.ttsVoiceId && !selectedVoiceAvailable && (
                <SelectItem value={value.ttsVoiceId} disabled>
                  {value.ttsVoiceId} (unavailable)
                </SelectItem>
              )}
              {compatibleVoices.map((voice) => (
                <SelectItem key={voice.id} value={voice.id}>
                  {getVoiceOptionLabel(voice)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        These agent settings apply to every Voice line. Automatic language follows the caller, and Zavu selects the default voice.
      </p>
      {error && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-destructive" role="alert">
            {error}. Existing settings are preserved.
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
