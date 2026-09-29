export const OUTREACH_ACTIVITY_KEYS = ["leads_initial_cold_outreach", "leads_follow_up"] as const
export type OutreachActivityKey = typeof OUTREACH_ACTIVITY_KEYS[number]
export type OutreachChannel = string
export type OutreachSettings = {
  status: "active" | "inactive" | "default"
  channel_accounts: Record<string, string[]>
  segment_ids: string[]
  all_segments: boolean
  daily_message_limit: number
  max_unanswered_messages: number
  weekdays: number[]
}

export function isOutreachActivity(key: string): key is OutreachActivityKey {
  return OUTREACH_ACTIVITY_KEYS.includes(key as OutreachActivityKey)
}

const strings = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))]
  : []

/** Keys become form paths and object properties; audio is a message format, not a channel. */
export function isOutreachChannel(value: unknown): value is OutreachChannel {
  return typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value)
    && value !== "prototype" && value !== "audio" && !Object.prototype.hasOwnProperty.call(Object.prototype, value)
}

export function normalizeOutreachChannelAccounts(value: unknown): Record<string, string[]> {
  const accounts: Record<string, string[]> = { email: [], whatsapp: [] }
  if (!value || typeof value !== "object" || Array.isArray(value)) return accounts
  for (const [channel, ids] of Object.entries(value)) {
    if (isOutreachChannel(channel)) accounts[channel] = strings(ids)
  }
  return accounts
}

/** Legacy default/missing status is deliberately opt-out, never an implicit activation. */
export function normalizeOutreachSettings(value: unknown): OutreachSettings & { status: "active" | "inactive" } {
  const data = value && typeof value === "object" ? value as Partial<OutreachSettings> : {}
  const status = typeof value === "string" ? value : data.status
  return {
    status: status === "active" ? "active" : "inactive",
    channel_accounts: normalizeOutreachChannelAccounts(data.channel_accounts),
    segment_ids: strings(data.segment_ids),
    all_segments: data.all_segments === true,
    // Do not silently repair invalid saved caps; let validation ask the user to fix them.
    daily_message_limit: data.daily_message_limit === undefined ? 30 : data.daily_message_limit,
    max_unanswered_messages: data.max_unanswered_messages === undefined ? 3 : data.max_unanswered_messages,
    weekdays: data.weekdays === undefined ? [2, 3, 4] : Array.isArray(data.weekdays) ? [...new Set(data.weekdays)] : [],
  }
}

export type OutreachAccount = { id: string; channel: OutreachChannel; label: string }
export type OutreachValidationError = { field: keyof OutreachSettings; message: string }

export function getOutreachTimezone(businessHours: unknown): string {
  const timezone = Array.isArray(businessHours)
    ? businessHours[0]?.timezone
    : (businessHours as { timezone?: unknown } | null)?.timezone
  return typeof timezone === "string" && timezone.length ? timezone : "America/Mexico_City"
}

export function isValidOutreachTimezone(timezone: string): boolean {
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return true } catch { return false }
}

export function validateOutreachSettings(
  value: OutreachSettings,
  key: OutreachActivityKey,
  accounts?: OutreachAccount[],
  segmentIds?: string[],
): OutreachValidationError[] {
  const errors: OutreachValidationError[] = []
  if (!Number.isInteger(value.daily_message_limit) || value.daily_message_limit < 1 || value.daily_message_limit > 10000) {
    errors.push({ field: "daily_message_limit", message: "Enter a whole number from 1 to 10,000 messages per day." })
  }
  if (!Number.isInteger(value.max_unanswered_messages) || value.max_unanswered_messages < 1 || value.max_unanswered_messages > 100) {
    errors.push({ field: "max_unanswered_messages", message: "Enter a whole number from 1 to 100 unanswered messages." })
  }
  if (value.status !== "active") return errors
  const selected = Object.entries(normalizeOutreachChannelAccounts(value.channel_accounts)).some(([channel, ids]) =>
    ids.some(id => !accounts || accounts.some(account => account.id === id && account.channel === channel)))
  if (!selected) {
    errors.push({ field: "channel_accounts", message: "Select at least one connected, usable channel account before enabling this activity." })
  }
  if (!value.all_segments && !value.segment_ids.some(id => !segmentIds || segmentIds.includes(id))) {
    errors.push({ field: "segment_ids", message: "Select at least one segment for this site, or explicitly enable all segments." })
  }
  if (segmentIds && value.segment_ids.some(id => !segmentIds.includes(id))) {
    errors.push({ field: "segment_ids", message: "Remove unavailable segments before enabling or saving this activity." })
  }
  if (key === "leads_follow_up" && (!value.weekdays.length || value.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
    errors.push({ field: "weekdays", message: "Select at least one valid follow-up weekday." })
  }
  return errors
}