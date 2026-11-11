"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import { getLeadAutomationSnooze } from "../automation-snooze-actions"

export function useLeadAutomationSnooze(leadId: string, siteId: string, userId?: string) {
  const result = useSWR(userId && siteId && !siteId.startsWith("demo-")
    ? ["lead-automation-snooze", leadId, siteId, userId] : null,
  async ([, lead, site]) => {
    const response = await getLeadAutomationSnooze(lead, site)
    if (response.error) throw new Error(response.error)
    return response.data
  }, { refreshInterval: 60_000, revalidateOnFocus: true })
  const { mutate } = result
  useEffect(() => {
    if (!userId || !siteId || siteId.startsWith("demo-")) return
    const supabase = createClient()
    const channel = supabase.channel(`lead-snooze-${siteId}-${leadId}-${userId}`)
    channel.on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `lead_id=eq.${leadId}` }, () => { void mutate() })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads", filter: `id=eq.${leadId}` }, () => { void mutate() })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings", filter: `site_id=eq.${siteId}` }, () => { void mutate() })
      .subscribe((status: string) => { if (status === "SUBSCRIBED") void mutate() })
    return () => { void supabase.removeChannel(channel) }
  }, [leadId, siteId, userId, mutate])
  return result
}