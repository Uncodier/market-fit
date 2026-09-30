"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { DynamicOptionsLoadingProps } from "next/dynamic"
import { Skeleton } from "@/app/components/ui/skeleton"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { ReportKpiGrid } from "@/app/components/dashboard/report-layout"
import { cn } from "@/lib/utils"
import { getReportSection, type ReportId } from "./report-sections"
import { OverviewActivityLayout } from "./OverviewActivityLayout"
import { ReportChartLoading } from "@/app/components/dashboard/report-visual-loading"
import { RecentActivityLoading } from "@/app/components/dashboard/recent-activity-loading"

type LoadingSelection = { report?: ReportId; section?: string }
const ReportLoadingContext = createContext<LoadingSelection>({})

export function ReportLoadingScope({ report, section, children }: LoadingSelection & { children: ReactNode }) {
  return <ReportLoadingContext.Provider value={{ report, section }}>{children}</ReportLoadingContext.Provider>
}

export function useReportLoadingSelection() {
  return useContext(ReportLoadingContext)
}

type PanelKind = "chart" | "distribution" | "table" | "list"
type Panel = {
  kind: PanelKind
  height?: string
  rows?: number
  columns?: number
  summary?: number
  footer?: boolean
  bare?: boolean
  compact?: boolean
  scopeNote?: boolean
}
type LoadingLayout = {
  kpis?: number
  gap?: string
  groups: { columns?: string; panels: Panel[]; heading?: boolean }[]
  note?: boolean
  details?: boolean
}
const pair = "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
const trend = { kind: "chart", height: "h-[300px] sm:h-[340px]", footer: true } as const
const distribution = { kind: "distribution", height: "h-[300px] sm:h-[340px]", rows: 3 } as const
const table = { kind: "table", rows: 5, columns: 5 } as const

function loadingLayout(report: ReportId, section: string): LoadingLayout {
  switch (report) {
    case "performance": return {
      kpis: 4, groups: [{ panels: [{ kind: "chart", height: "h-[300px] sm:h-[360px]", footer: section !== "usage" }] }],
    }
    case "overview":
      if (section === "economics") return {
        kpis: 4, gap: "space-y-5", details: true,
        groups: [{ columns: "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]", panels: [
          { kind: "chart", height: "h-56 sm:h-64", footer: true },
          { kind: "chart", height: "h-56 sm:h-64", footer: true },
        ] }],
      }
      return { kpis: 4, gap: "space-y-5", groups: [{ panels: [trend] }] }
    case "sales":
      if (section === "categories") return { note: true, details: true, groups: [{ panels: [table] }] }
      return { kpis: 3, details: true, groups: [{ columns: section === "channels" ? pair : undefined,
        panels: section === "channels" ? [trend, distribution] : [trend] }] }
    case "costs":
      if (section === "categories") return { details: true, groups: [{ panels: [table] }] }
      return { kpis: 4, details: true, groups: [{ columns: pair, panels: [
        { kind: "chart", height: "h-72 sm:h-80", footer: true, scopeNote: true },
        { kind: "distribution", height: "h-56 xl:h-80", rows: 5, scopeNote: true },
      ] }] }
    case "analytics":
      if (section === "customers" || section === "leads") return {
        gap: "space-y-5", note: true, details: true,
        groups: Array.from({ length: section === "customers" ? 2 : 1 }, () => ({ panels: [{ ...table, bare: true, columns: 6 }] })),
      }
      return { gap: "space-y-6", details: true, groups: Array.from({ length: 2 }, () => ({
        heading: true, columns: "lg:grid-cols-2", panels: [
          { kind: "distribution", height: "h-56", rows: 4 }, { kind: "distribution", height: "h-56", rows: 4 },
        ],
      })) }
    case "traffic":
      if (section === "audience") return { gap: "space-y-6", details: true, groups: [{ columns: "xl:grid-cols-3", panels: [
        { kind: "list", rows: 5 }, { kind: "distribution", compact: true, rows: 3 }, { kind: "distribution", compact: true, rows: 3 },
      ] }] }
      if (section === "sessions") return { groups: [{ columns: pair, panels: [
        { kind: "chart", summary: 3, height: "h-[320px] sm:h-[360px]" }, { kind: "table", columns: 3, rows: 6 },
      ] }] }
      return { kpis: 4, gap: "space-y-6", details: true, groups: [{ columns: pair, panels: [
        { kind: "list", rows: 5 }, { kind: "distribution", compact: true, rows: 3 },
      ] }] }
    case "social":
      if (section === "posts") return { details: true, groups: [{ panels: [{ ...table, columns: 8, rows: 5 }] }] }
      if (section === "networks") return { details: true, groups: [{ columns: pair, panels: [
        { kind: "list", rows: 3 }, { kind: "list", rows: 5 },
      ] }] }
      return { kpis: 4, details: true, groups: [{ panels: [{ ...trend, summary: 2 }] }] }
  }
}

function Line({ className }: { className: string }) {
  return <Skeleton className={cn("max-w-full bg-muted/60 motion-reduce:animate-none", className)} />
}

function LoadingKpis({ count, report, section }: { count: number; report: ReportId; section: string }) {
  const titles = report === "sales" ? section === "channels"
    ? ["Online sales", "Retail sales", "Other / unassigned"] : ["Confirmed sales", "Transactions", "Average sale value"]
    : report === "costs" ? ["Total Costs", "Marketing Costs", "Efficiency Ratio", "Overhead Costs"]
    : report === "social" ? ["Views", "Reach", "Engagement Rate", "Comments"]
    : report === "traffic" ? ["Sessions", "Session Time", "Lead Conversion", "Client Conversion"]
    : report === "overview" ? section === "economics"
      ? ["Customer value", "Acquisition cost", "Cost per lead", "Return on recorded cost"]
      : ["Revenue", "Active Users", "Active Segments", "Active Campaigns"]
    : section === "usage" ? ["Input Tokens", "Output Tokens", "Video Minutes", "Images Generated"]
    : section === "operations" ? ["Tasks", "Conversations", "Contents Approved", "Requirements Completed"]
    : ["Leads Contacted", "Leads in Conversation", "Meetings", "Sales"]
  return <ReportKpiGrid columns={count === 3 ? 3 : 4}>
    {titles.map(title => <BaseKpiWidget key={title} title={title} value={null} changeText="" isLoading />)}
  </ReportKpiGrid>
}

function LoadingRows({ rows = 5, columns = 2 }: { rows?: number; columns?: number }) {
  return <div className="min-w-0 divide-y">
    {Array.from({ length: rows }, (_, row) => <div key={row} className="flex min-h-12 min-w-0 items-center gap-4 py-3">
      {Array.from({ length: columns }, (_, column) => <Line key={column} className={cn("h-3 min-w-0 flex-1", column === 0 && "basis-1/4")} />)}
    </div>)}
  </div>
}

function LoadingPanel({ kind, height, rows, columns, summary, footer, bare, compact, scopeNote }: Panel) {
  return <div data-loading-panel={kind} className={cn("min-w-0 overflow-hidden", !bare && "h-full rounded-lg border bg-background")}>
    <div className={cn("space-y-2", bare ? "mb-3" : "p-4 pb-3 sm:p-5 sm:pb-3")}>
      <Line className="h-5 w-44" />
      {!bare && <Line className="h-3 w-64" />}
      {scopeNote && <Line className="h-4 w-80" />}
    </div>
    <div className={cn("min-w-0", !bare && "p-4 pt-0 sm:p-5 sm:pt-0")}>
      {summary && <div className="mb-4 flex gap-5" data-loading-summary>
        {Array.from({ length: summary }, (_, index) => <div key={index} className="min-w-0 space-y-2"><Line className="h-3 w-24" /><Line className="h-7 w-20" /></div>)}
      </div>}
      {kind === "chart" && <div data-loading-plot className={cn("flex min-w-0 flex-col justify-between pb-5 pt-3", height)}>
        <div className="ml-8 flex flex-1 flex-col justify-between border-b border-l border-border/50 px-3 py-2">
          {[0, 1, 2, 3].map(index => <div key={index} className="border-t border-dashed border-border/40" />)}
        </div>
        <div className="mt-3 flex justify-center gap-5"><Line className="h-3 w-20" /><Line className="h-3 w-20" /></div>
      </div>}
      {kind === "distribution" && compact ? <div className="grid min-w-0 items-start gap-3 sm:grid-cols-[112px_minmax(0,1fr)]">
        <div className="mx-auto mt-2 h-[100px] w-[100px] rounded-full border-[18px] border-muted/50" />
        <LoadingRows rows={rows} />
      </div> : kind === "distribution" && <div data-loading-plot className={cn("flex items-center justify-center", height)}>
        <div className="h-40 w-40 rounded-full border-[22px] border-muted/50" />
      </div>}
      {kind === "table" && <div className={cn("min-w-0 overflow-hidden", bare && "rounded-md border px-4")}>
        <div className="border-b"><LoadingRows rows={1} columns={columns} /></div>
        <LoadingRows rows={rows} columns={columns} />
      </div>}
      {(kind === "list" || (kind === "distribution" && !compact)) && <LoadingRows rows={rows} />}
      {footer && <div className="mt-3 space-y-3"><Line className="mx-auto h-4 w-36" /><Line className="h-3 w-52" /></div>}
    </div>
  </div>
}

/** Module, policy and data loading share the selected section's structure. */
export function ReportLoading({ report, section, chartOnly = false }: LoadingSelection & DynamicOptionsLoadingProps & { chartOnly?: boolean } = {}) {
  const selection = useReportLoadingSelection()
  const activeReport = report ?? selection.report ?? "performance"
  const activeSection = getReportSection(activeReport, section ?? selection.section ?? null)
  const layout: LoadingLayout = chartOnly
    ? { groups: [{ panels: [{ kind: "chart", height: "h-[300px] sm:h-[360px]" } as Panel] }] }
    : loadingLayout(activeReport, activeSection)
  return <div role="status" aria-label="Loading report" aria-busy="true" className="min-w-0"
    data-loading-report={activeReport} data-loading-section={activeSection}>
    <span className="sr-only">Loading report…</span>
    <div aria-hidden="true" className={cn("min-w-0", layout.gap ?? "space-y-4")}>
      {activeReport === "overview" && activeSection === "activity" && !chartOnly
        ? <OverviewActivityLayout loading chart={<ReportChartLoading />} activity={<RecentActivityLoading />} />
        : <>
      {layout.kpis && <LoadingKpis count={layout.kpis} report={activeReport} section={activeSection} />}
      {layout.note && <Line className="h-5 w-96" />}
      {layout.groups.map((group, index) => <div key={index} className="min-w-0 space-y-4">
        {group.heading && <div className="space-y-2"><Line className="h-5 w-40" /><Line className="h-4 w-80" /></div>}
        <div data-loading-group className={cn("grid min-w-0 grid-cols-1 items-stretch gap-4", group.columns)}>
          {group.panels.map((panel, index) => <LoadingPanel key={index} {...panel} />)}
        </div>
      </div>)}
      {layout.details && <div className="border-t pt-3"><Line className="my-1 h-4 w-48" /></div>}
      </>}
    </div>
  </div>
}