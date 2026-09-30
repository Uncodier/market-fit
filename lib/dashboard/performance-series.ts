export type DatedRow = { created_at: string }
export type MeetingRow = { scheduled_date: string }
export type EngagedLead = { conversations?: { messages?: DatedRow[] }[] }

/** Index each row once, instead of rescanning every result for every chart day. */
export function buildPerformanceSeries(input: {
  start: Date
  end: Date
  timeZone: string
  leads: DatedRow[]
  conversations: DatedRow[]
  engagement: EngagedLead[]
  tasks: DatedRow[]
  meetings: MeetingRow[]
  sales: DatedRow[]
}) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  })
  const dayKey = (date: Date) => {
    const parts = formatter.formatToParts(date)
    return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-")
  }
  const firstDay = dayKey(input.start)
  const lastDay = dayKey(input.end)
  const buckets = new Map<string, {
    date: string; leadsCreated: number; conversations: number; engagement: number; tasks: number; meetings: number; sales: number
  }>()
  // Iterate calendar labels in UTC; the site's daylight-saving offset cannot skip a day.
  for (let day = firstDay; day <= lastDay;) {
    buckets.set(day, { date: day, leadsCreated: 0, conversations: 0, engagement: 0, tasks: 0, meetings: 0, sales: 0 })
    const next = new Date(`${day}T00:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    day = next.toISOString().slice(0, 10)
  }
  const increment = (timestamp: string, metric: "leadsCreated" | "conversations" | "tasks" | "meetings" | "sales") => {
    const date = new Date(timestamp)
    if (!Number.isFinite(date.getTime()) || date < input.start || date > input.end) return
    const bucket = buckets.get(dayKey(date))
    if (bucket) bucket[metric]++
  }
  input.leads.forEach(row => increment(row.created_at, "leadsCreated"))
  input.conversations.forEach(row => increment(row.created_at, "conversations"))
  input.tasks.forEach(row => increment(row.created_at, "tasks"))
  input.meetings.forEach(row => increment(row.scheduled_date, "meetings"))
  input.sales.forEach(row => increment(row.created_at, "sales"))
  for (const lead of input.engagement) {
    const activeDays = new Set<string>()
    for (const conversation of lead.conversations ?? []) {
      for (const message of conversation.messages ?? []) {
        const date = new Date(message.created_at)
        if (Number.isFinite(date.getTime()) && date >= input.start && date <= input.end) activeDays.add(dayKey(date))
      }
    }
    for (const day of activeDays) {
      const bucket = buckets.get(day)
      if (bucket) bucket.engagement++
    }
  }
  return Array.from(buckets.values())
}