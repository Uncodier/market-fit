"use client"

import useSWR from "swr"
import { apiClient } from "@/app/services/api-client-service"
import type { VoiceOptionsResponse } from "./voice-agent-settings"

const EMPTY_OPTIONS: VoiceOptionsResponse = {
  items: [],
  languages: [],
}

export function useZavuVoiceOptions(siteId: string) {
  const { data, error, isLoading, mutate } = useSWR<VoiceOptionsResponse>(
    siteId ? ["zavu-voice-options", siteId] : null,
    async () => {
      const response = await apiClient.get(
        `/api/integrations/zavu/voice/options?siteId=${encodeURIComponent(siteId)}`
      )
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load Voice options")
      }
      return {
        items: Array.isArray(response.data?.items) ? response.data.items : [],
        languages: Array.isArray(response.data?.languages)
          ? response.data.languages
          : [],
        ...(typeof response.data?.total === "number"
          ? { total: response.data.total }
          : {}),
        ...(response.data?.preferences
          ? { preferences: response.data.preferences }
          : {}),
      }
    },
    {
      dedupingInterval: 60_000,
      errorRetryCount: 2,
    }
  )

  return {
    ...(data || EMPTY_OPTIONS),
    isLoading,
    error: error instanceof Error ? error.message : error ? "Failed to load Voice options" : null,
    mutate,
  }
}
