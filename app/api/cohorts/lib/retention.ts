import { isoWeekLabel, mondayUtc, WEEK_MS } from "./period"
import type { CohortEvent, CohortRow, CohortWindow } from "./types"

/** Each identified lead enters exactly once, at its first observed baseline event. */
export function cohortBaselines(events: CohortEvent[], window: CohortWindow): CohortEvent[] {
  const first = new Map<string, CohortEvent>()
  const start = Date.parse(window.startDate)
  const end = Date.parse(window.observationEnd)
  for (const event of events) {
    const at = Date.parse(event.at)
    if (!Number.isFinite(at)) throw new Error("Invalid cohort event timestamp")
    if (!event.leadId || at < start || at > end) continue
    const previous = first.get(event.leadId)
    if (!previous || at < Date.parse(previous.at)) first.set(event.leadId, event)
  }
  return [...first.values()]
}

/** Null means unavailable/incomplete, never measured inactivity. Week 0 is membership. */
export function retentionRows(
  baseline: CohortEvent[],
  activity: CohortEvent[] | null,
  window: CohortWindow,
): CohortRow[] {
  const cohorts = new Map<number, Set<string>>()
  const members = cohortBaselines(baseline, window)
  const firstByLead = new Map(members.map(event => [event.leadId, Date.parse(event.at)]))
  for (const event of members) {
    const week = mondayUtc(event.at)
    if (!cohorts.has(week)) cohorts.set(week, new Set())
    cohorts.get(week)!.add(event.leadId)
  }
  const activeWeeks = new Map<number, Set<string>>()
  const end = Date.parse(window.observationEnd)
  for (const event of activity ?? []) {
    const at = Date.parse(event.at)
    if (!Number.isFinite(at)) throw new Error("Invalid cohort activity timestamp")
    const first = firstByLead.get(event.leadId)
    if (first === undefined || at < first || at > end) continue
    const week = mondayUtc(at)
    if (!activeWeeks.has(week)) activeWeeks.set(week, new Set())
    activeWeeks.get(week)!.add(event.leadId)
  }
  const width = 1 + Math.round((mondayUtc(window.endDate) - mondayUtc(window.startDate)) / WEEK_MS)
  return [...cohorts.entries()].sort(([a], [b]) => b - a).map(([week, leads]) => ({
    cohort: isoWeekLabel(week),
    cohortStart: new Date(week).toISOString(),
    size: leads.size,
    weeks: Array.from({ length: width }, (_, index) => {
      if (index === 0) return 100
      const targetWeek = week + index * WEEK_MS
      if (activity === null || targetWeek + WEEK_MS - 1 > end) return null
      const active = activeWeeks.get(targetWeek)
      let retained = 0
      for (const lead of leads) if (active?.has(lead)) retained++
      return Math.round(retained / leads.size * 100)
    }),
  }))
}