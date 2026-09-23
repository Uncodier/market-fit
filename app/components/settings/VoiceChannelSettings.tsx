"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { Button } from "@/app/components/ui/button"
import {
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { VoiceAgentSettingsFields } from "./VoiceAgentSettingsFields"
import {
  readVoiceAgentSettings,
  type VoiceAgentSettingsValue,
} from "./voice-agent-settings"
import { useCanManageVoiceChannel } from "./use-can-manage-voice-channel"
import { useZavuVoiceOptions } from "./use-zavu-voice-options"

type DirtyVoiceFields = {
  language: boolean
  ttsVoiceId: boolean
}

export function VoiceChannelSettings({
  siteId,
  channel,
  onUpdated,
}: {
  siteId: string
  channel: any
  onUpdated: (payload: any) => void | Promise<void>
}) {
  const metadataLanguage = channel?.metadata?.voice_language
  const metadataVoiceId = channel?.metadata?.tts_voice_id
  const metadataSettings = useMemo(
    () => readVoiceAgentSettings({
      metadata: {
        voice_language: metadataLanguage,
        tts_voice_id: metadataVoiceId,
      },
    }),
    [metadataLanguage, metadataVoiceId]
  )
  const voiceOptions = useZavuVoiceOptions(siteId)
  const canManageVoice = useCanManageVoiceChannel()
  const canonical = useMemo<VoiceAgentSettingsValue>(
    () => ({
      language:
        voiceOptions.preferences?.language || metadataSettings.language,
      ttsVoiceId:
        voiceOptions.preferences
          ? voiceOptions.preferences.ttsVoiceId || ""
          : metadataSettings.ttsVoiceId,
    }),
    [
      metadataSettings.language,
      metadataSettings.ttsVoiceId,
      voiceOptions.preferences?.language,
      voiceOptions.preferences?.ttsVoiceId,
    ]
  )
  const [value, setValue] = useState<VoiceAgentSettingsValue>(canonical)
  const [dirty, setDirty] = useState<DirtyVoiceFields>({
    language: false,
    ttsVoiceId: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const isDirty = dirty.language || dirty.ttsVoiceId

  useEffect(() => {
    setValue((current) => ({
      language: dirty.language ? current.language : canonical.language,
      ttsVoiceId: dirty.ttsVoiceId
        ? current.ttsVoiceId
        : canonical.ttsVoiceId,
    }))
  }, [
    canonical.language,
    canonical.ttsVoiceId,
    dirty.language,
    dirty.ttsVoiceId,
  ])

  const updateDraft = (next: VoiceAgentSettingsValue) => {
    setValue(next)
    setDirty({
      language: next.language !== canonical.language,
      ttsVoiceId: next.ttsVoiceId !== canonical.ttsVoiceId,
    })
  }

  const save = async () => {
    if (!channel?.id) {
      toast.error("Voice channel configuration is incomplete")
      return
    }
    setIsSaving(true)
    try {
      const response = await apiClient.patch("/api/integrations/zavu/voice", {
        siteId,
        channelId: channel.id,
        ...(dirty.language ? { language: value.language } : {}),
        ...(dirty.ttsVoiceId
          ? { ttsVoiceId: value.ttsVoiceId || null }
          : {}),
      })
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to save Voice settings")
      }
      const payload = response.data
      if (!payload?.connection && !Array.isArray(payload?.connections)) {
        throw new Error("Voice settings were saved but the response was incomplete")
      }
      const savedValue = {
        language: payload.voiceLanguage || value.language,
        ttsVoiceId: payload.ttsVoiceId || "",
      }
      await voiceOptions.mutate(
        (current) => ({
          ...(current || { items: [], languages: [] }),
          preferences: {
            language: savedValue.language,
            ...(savedValue.ttsVoiceId
              ? { ttsVoiceId: savedValue.ttsVoiceId }
              : {}),
          },
        }),
        { revalidate: false }
      )
      setValue(savedValue)
      setDirty({ language: false, ttsVoiceId: false })
      await onUpdated(payload)
      toast.success("Voice settings saved")
    } catch (error: any) {
      toast.error(error?.message || "Failed to save Voice settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <SectionCardContent className="pt-0">
        <div className="space-y-3 rounded-lg border border-black/5 bg-muted/20 p-4 dark:border-white/5">
          <div>
            <p className="text-sm font-medium">Voice behavior</p>
            <p className="text-xs text-muted-foreground">
              Choose how the Customer Support agent listens and speaks on this phone line.
            </p>
          </div>
          <VoiceAgentSettingsFields
            value={value}
            onChange={updateDraft}
            options={voiceOptions}
            onRetry={() => {
              void voiceOptions.mutate()
            }}
            disabled={isSaving || !canManageVoice}
          />
          {!canManageVoice && (
            <p className="text-xs text-muted-foreground">
              Only site owners and administrators can change Voice settings.
            </p>
          )}
        </div>
      </SectionCardContent>
      <SectionCardFooter className="justify-end">
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!isDirty || isSaving || !canManageVoice}
        >
          {isSaving ? "Saving..." : "Save Voice Settings"}
        </Button>
      </SectionCardFooter>
    </>
  )
}
