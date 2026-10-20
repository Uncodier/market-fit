import { availableDemos, getDemoData, isKnownDemoSite } from "@/lib/demo-data"
import { loadDemoDashboardBatch } from "@/lib/demo-data/overview-report"
import { attachDemoPerformance } from "@/lib/demo-data/performance-seed"
import { buildDemoPerformance } from "@/lib/demo-data/performance-report"
import { demoReportContext } from "@/lib/demo-data/report-context"
import { isReportBatch, reportMetricKeys, type PerformanceGroup } from "@/lib/dashboard/report-groups"
import { shiftDay } from "@/lib/sales/report-period"
import type { DemoReportRow } from "@/lib/demo-data/report-types"

const today = new Date().toISOString().slice(0, 10)
const groups: (PerformanceGroup | undefined)[] = ["outcomes", "operations", "usage", undefined]
const filters = (siteId: string, group?: string, segmentId = "all", startDate = shiftDay(today, -29), endDate = today) => {
  const params = new URLSearchParams({ siteId, segmentId, startDate, endDate })
  if (group !== undefined) params.set("group", group)
  return params
}
type Daily = { date: string } & Record<string, number | string>

beforeEach(() => { (fetch as jest.Mock).mockReset() })

describe.each(availableDemos)("Performance fixtures: $id", ({ id }) => {
  it.each(groups)("populates selected %s metrics with current and prior-period coverage", async group => {
    const batch = await loadDemoDashboardBatch("performance", filters(id, group))
    const keys = reportMetricKeys("performance", group)!
    expect(Object.keys(batch)).toEqual(keys)
    expect(isReportBatch(batch, keys)).toBe(true)
    for (const key of keys) {
      expect(batch[key].actual).toBeGreaterThan(0)
      expect(batch[key].previous).toBeGreaterThan(0)
      expect(Number.isFinite(Number(batch[key].percentChange))).toBe(true)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it("preserves the inclusive activity and token chart shapes and totals", async () => {
    const batch = await loadDemoDashboardBatch("performance", filters(id))
    for (const key of ["tokens", "metrics-overview"]) {
      const chart = batch[key].chartData as Daily[]
      const breakdown = batch[key].breakdown as Record<string, number>
      expect(chart).toHaveLength(30)
      expect(chart[0].date).toBe(shiftDay(today, -29))
      expect(chart[29].date).toBe(today)
      for (const metric of Object.keys(breakdown)) {
        expect(chart.every(row => typeof row[metric] === "number")).toBe(true)
        expect(chart.reduce((sum, row) => sum + Number(row[metric]), 0)).toBe(breakdown[metric])
      }
    }
    const tokens = batch.tokens.breakdown as Record<string, number>
    expect(tokens.commands).toBeGreaterThan(0)
    expect(tokens.instanceLogs).toBeGreaterThan(0)
    expect(tokens.inputTokens + tokens.outputTokens).toBe(batch.tokens.actual)
    expect(tokens.commands + tokens.instanceLogs).toBe(batch.tokens.actual)
    const params = filters(id, "usage", "all", today, today)
    expect((await loadDemoDashboardBatch("performance", params)).tokens.chartData).toHaveLength(1)
  })

  it("covers every selectable segment across every group and does not leak all-segment usage", async () => {
    const data = await getDemoData(id)
    const all = await loadDemoDashboardBatch("performance", filters(id))
    for (const segment of data!.segments) {
      for (const group of groups) {
        const batch = await loadDemoDashboardBatch("performance", filters(id, group, segment.id))
        for (const key of reportMetricKeys("performance", group)!) {
          expect(batch[key].actual).toBeGreaterThan(0)
          expect(batch[key].previous).toBeGreaterThan(0)
          expect(Number(batch[key].actual)).toBeLessThan(Number(all[key].actual))
        }
      }
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(groups)("keeps unknown segments and empty dates empty for %s", async group => {
    for (const params of [filters(id, group, "missing-segment"),
      filters(id, group, "all", shiftDay(today, 365), shiftDay(today, 394))]) {
      const batch = await loadDemoDashboardBatch("performance", params)
      for (const key of reportMetricKeys("performance", group)!) {
        expect(batch[key].actual).toBe(0)
        expect(batch[key].previous).toBe(0)
        const chart = batch[key].chartData as Daily[] | undefined
        expect(chart?.every(row => Object.entries(row).every(([name, value]) => name === "date" || value === 0)) ?? true).toBe(true)
      }
    }
  })

  it("refreshes linked samples idempotently without mutating unrelated records or Overview", async () => {
    const data = await getDemoData(id)
    const snapshot = JSON.stringify(data)
    const nextDate = new Date(`${shiftDay(today, 365)}T12:00:00Z`)
    const refreshed = attachDemoPerformance(data!, nextDate)
    expect(JSON.stringify(data)).toBe(snapshot)
    expect(attachDemoPerformance(refreshed, nextDate)).toEqual(refreshed)
    for (const table of ["leads", "tasks", "conversations", "messages", "sales", "sale_orders", "transactions", "campaigns"]) {
      expect(refreshed[table]).toBe(data![table])
    }
    for (const table of ["content", "requirements", "requirement_segments", "commands", "instance_logs"]) {
      const samples = refreshed[table].filter(row => row.id.startsWith(`${id}-performance-`))
      expect(refreshed[table]).toHaveLength(data![table].length)
      expect(new Set(refreshed[table].map(row => row.id)).size).toBe(refreshed[table].length)
      expect(samples.some(row => row.created_at.slice(0, 10) === shiftDay(today, 365))).toBe(true)
      expect(samples.every(row => row.site_id === id)).toBe(true)
      const originals = (data![table] as DemoReportRow[]).filter(row => !row.id.startsWith(`${id}-performance-`))
      expect(refreshed[table].filter(row => !row.id.startsWith(`${id}-performance-`))).toEqual(originals)
    }
    for (const command of refreshed.commands.filter(row => row.id.startsWith(`${id}-performance-`))) {
      expect(refreshed.leads.some(row => row.id === command.lead_id)).toBe(true)
      expect(refreshed.tasks.some(row => row.id === command.task_id)).toBe(true)
      expect(refreshed.conversations.some(row => row.id === command.conversation_id)).toBe(true)
      expect(refreshed.content.some(row => row.id === command.content_id)).toBe(true)
      expect(refreshed.requirements.some(row => row.id === command.requirement_id)).toBe(true)
    }
    for (const log of refreshed.instance_logs.filter(row => row.id.startsWith(`${id}-performance-`))) {
      expect(refreshed.commands.some(row => row.id === log.command_id)).toBe(true)
      expect(refreshed.remote_instances.some(row => row.id === log.instance_id)).toBe(true)
    }
    for (const link of refreshed.requirement_segments.filter(row => row.id.startsWith(`${id}-performance-`))) {
      expect(refreshed.requirements.some(row => row.id === link.requirement_id)).toBe(true)
      expect(refreshed.segments.some(row => row.id === link.segment_id)).toBe(true)
    }
  })
})

it("rejects unknown/real sites, invalid groups, dates, and oversized ranges locally", async () => {
  for (const id of ["demo-unknown", "real-site", ""]) {
    expect(isKnownDemoSite(id)).toBe(false)
    for (const group of groups) await expect(loadDemoDashboardBatch("performance", filters(id, group))).rejects.toThrow("Unknown demo site")
  }
  const id = availableDemos[0].id
  await expect(loadDemoDashboardBatch("performance", filters(id, "invalid"))).rejects.toThrow("Unknown demo report section")
  await expect(loadDemoDashboardBatch("performance", filters(id, "usage", "all", "invalid-date"))).rejects.toThrow()
  await expect(loadDemoDashboardBatch("performance", filters(id, "usage", "all", today, shiftDay(today, -1)))).rejects.toThrow()
  await expect(loadDemoDashboardBatch("performance", filters(id, "usage", "all", shiftDay(today, -100)))).rejects.toThrow("too large")
  expect(fetch).not.toHaveBeenCalled()
})

it("uses command/log token fields, duration_ms, tool names and requirement junctions", async () => {
  const context = await demoReportContext(filters(availableDemos[0].id, "usage", "segment-test", today, today))
  const row = (id: string, fields: Record<string, unknown> = {}): DemoReportRow => ({ id, created_at: `${today}T12:00:00Z`, ...fields })
  const data: Record<string, DemoReportRow[]> = {
    commands: [row("command", { segment_id: "segment-test", input_tokens: 10, output_tokens: 5 })],
    instance_logs: [row("image", { command_id: "command", tool_name: "GENERATE_IMAGE", tokens_used: { promptTokens: 3, completionTokens: 2 } }),
      row("video", { segment_id: "segment-test", tool_name: "generate_video", duration_ms: 90_000, tokens_used: { prompt: 100, completion: 100 } }),
      row("foreign", { segment_id: "other", tool_name: "generate_image", tokens_used: { promptTokens: 999 } })],
    requirements: [row("requirement", { completion_status: "completed" }), row("pending", { completion_status: "pending" })],
    requirement_segments: [row("link", { requirement_id: "requirement", segment_id: "segment-test" }),
      row("pending-link", { requirement_id: "pending", segment_id: "segment-test" })],
  }
  const local = { ...context, rows: (table: string) => data[table] || [],
    scoped: (table: string) => (data[table] || []).filter(row => row.segment_id === "segment-test") }
  const usage = buildDemoPerformance(local, "usage")
  expect(usage.tokens.actual).toBe(20)
  expect(usage.tokens.breakdown).toEqual({ commands: 15, instanceLogs: 5, inputTokens: 13, outputTokens: 7 })
  expect(usage["images-generated"].actual).toBe(1)
  expect(usage["video-minutes"].actual).toBe(1.5)
  expect(buildDemoPerformance(local, "operations")["requirements-completed"].actual).toBe(1)
})

it("leaves an input without a demo site/segments unchanged", () => {
  const empty = { content: [] }
  expect(attachDemoPerformance(empty)).toBe(empty)
})