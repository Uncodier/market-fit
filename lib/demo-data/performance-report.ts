import { reportMetricKeys, type ReportBatch } from "@/lib/dashboard/report-groups"
import { shiftDay } from "@/lib/sales/report-period"
import { buildDemoOutcomes } from "./activity-report"
import { demoMetric, type DemoReportContext, type DemoRow } from "./report-context"

function operations(context: DemoReportContext): ReportBatch {
  const { scoped, rows, inRange, segmentId } = context
  // Requirements use their segment junction, not a guessed direct relationship.
  const linkedRequirements = new Set(rows("requirement_segments")
    .filter(row => row.segment_id === segmentId).map(row => row.requirement_id))
  const requirements = rows("requirements").filter(row => row.completion_status === "completed" &&
    (segmentId === "all" || linkedRequirements.has(row.id)))
  const count = (items: DemoRow[], previous = false) => items.filter(row => inRange(row.created_at, previous)).length
  const metric = (items: DemoRow[]) => demoMetric(count(items), count(items, true))
  return {
    tasks: metric(scoped("tasks")),
    conversations: metric(scoped("conversations")),
    "contents-approved": metric(scoped("content").filter(row => row.status === "approved")),
    "requirements-completed": metric(requirements),
  }
}

function nonnegative(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function logTokens(row: DemoRow) {
  const value = row.tokens_used
  const tokens = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  // The metric contract uses promptTokens/completionTokens, not legacy prompt/completion.
  return { input: nonnegative(tokens.promptTokens), output: nonnegative(tokens.completionTokens) }
}

function usage(context: DemoReportContext): ReportBatch {
  const { rows, scoped, inRange, period, segmentId, leadMap } = context
  const commandMap = new Map(rows("commands").map(row => [row.id, row]))
  const commands = scoped("commands")
  const logs = rows("instance_logs").filter(row => {
    const command = commandMap.get(String(row.command_id || ""))
    const segment = row.segment_id || leadMap.get(row.lead_id || "")?.segment_id ||
      command?.segment_id || leadMap.get(command?.lead_id || "")?.segment_id
    return segmentId === "all" || segment === segmentId
  })
  const empty = () => ({ commands: 0, instanceLogs: 0, inputTokens: 0, outputTokens: 0 })
  const buckets = new Map<string, ReturnType<typeof empty> & { date: string }>()
  for (let date = period.start; date <= period.end; date = shiftDay(date, 1)) {
    buckets.set(date, { date, ...empty() })
  }
  const current = empty()
  const previous = empty()
  const add = (row: DemoRow, source: "commands" | "instanceLogs", input: number, output: number) => {
    const target = inRange(row.created_at) ? current : inRange(row.created_at, true) ? previous : null
    if (!target) return
    target[source] += input + output
    target.inputTokens += input
    target.outputTokens += output
    if (target === current) {
      const bucket = buckets.get(row.created_at.slice(0, 10))!
      bucket[source] += input + output
      bucket.inputTokens += input
      bucket.outputTokens += output
    }
  }
  for (const row of commands) add(row, "commands", nonnegative(row.input_tokens), nonnegative(row.output_tokens))
  for (const row of logs) {
    const tokens = logTokens(row)
    add(row, "instanceLogs", tokens.input, tokens.output)
  }
  const toolLogs = (name: string, previous = false) => logs.filter(row =>
    String(row.tool_name || "").toLowerCase().includes(name) && inRange(row.created_at, previous))
  const minutes = (previous = false) => Math.round(toolLogs("video", previous)
    .reduce((sum, row) => sum + nonnegative(row.duration_ms), 0) / 60_000 * 10) / 10
  return {
    tokens: {
      ...demoMetric(current.inputTokens + current.outputTokens, previous.inputTokens + previous.outputTokens),
      chartData: [...buckets.values()], breakdown: current,
    },
    "images-generated": demoMetric(toolLogs("image").length, toolLogs("image", true).length),
    "video-minutes": demoMetric(minutes(), minutes(true)),
  }
}

/** Shape fixture-derived metrics exactly like the selected dashboard batch. */
export function buildDemoPerformance(context: DemoReportContext, group?: string): ReportBatch {
  const keys = reportMetricKeys("performance", group)
  if (!keys) throw new Error("Unknown demo report section")
  const batch: ReportBatch = {
    ...(keys.includes("metrics-overview") ? buildDemoOutcomes(context) : {}),
    ...(keys.includes("tasks") ? operations(context) : {}),
    ...(keys.includes("tokens") ? usage(context) : {}),
  }
  return Object.fromEntries(keys.map(key => [key, batch[key]]))
}