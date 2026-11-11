"use client"

import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useAutomationSnooze } from "@/app/hooks/useAutomationSnooze"
import { AutomationPausedBadge } from "./AutomationPausedBadge"

/** Read-only status; configuration and resume live in individual lead menus. */
export function AutomationSnoozeStatus({ conversationId, siteId }: { conversationId: string; siteId: string }) {
  const { user } = useAuthContext()
  const { data } = useAutomationSnooze(conversationId, siteId, user?.id)
  return data ? <AutomationPausedBadge until={data.automation_paused_until} /> : null
}