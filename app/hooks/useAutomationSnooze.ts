"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { getConversationAutomationSnooze } from "@/app/chat/automation-snooze-actions"

export function useAutomationSnooze(conversationId: string, siteId: string, userId?: string) {
  const result = useSWR(
    userId && siteId && conversationId ? ["automation-snooze", conversationId, siteId, userId] : null,
    async ([, id, site]) => {
      const response = await getConversationAutomationSnooze(id, site)
      if (response.error) throw new Error(response.error)
      return response.data
    },
    { refreshInterval: 60_000, revalidateOnFocus: true },
  )
  const { mutate } = result

  useEffect(() => {
    if (!userId || !siteId || !conversationId) return
    const supabase = createClient()
    const channel = supabase.channel(`automation-snooze-${siteId}-${conversationId}-${userId}`)
    try {
      channel
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}`,
      }, () => { void mutate() })
      .subscribe((status: string) => {
        // Re-read after reconnect, including changes missed while disconnected.
        if (status === "SUBSCRIBED") void mutate()
      })
    } catch {
      // Keep focus revalidation and polling available if realtime cannot start.
      void supabase.removeChannel(channel)
      return
    }
    return () => { void supabase.removeChannel(channel) }
  }, [conversationId, siteId, userId, mutate])

  return result
}