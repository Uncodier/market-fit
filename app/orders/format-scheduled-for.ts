import { format, isValid } from "date-fns"

function parseScheduledFor(scheduledFor: string | null | undefined): Date | null {
  if (!scheduledFor) return null
  const date = new Date(scheduledFor)
  return isValid(date) ? date : null
}

export function formatScheduledFor(scheduledFor: string | null | undefined): string | null {
  const date = parseScheduledFor(scheduledFor)
  if (!date) return null
  return format(date, "MMM d · h:mm a")
}

export function isScheduledUpcoming(
  scheduledFor: string | null | undefined,
  now: Date = new Date()
): boolean {
  const date = parseScheduledFor(scheduledFor)
  if (!date) return false
  return date.getTime() > now.getTime()
}

export function scheduledForClassName(scheduledFor: string | null | undefined): string {
  return isScheduledUpcoming(scheduledFor)
    ? "text-amber-700 dark:text-amber-400"
    : "text-muted-foreground"
}
