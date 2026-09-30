"use client"

import { ReportState } from "./report-state"
import { CohortRetentionTable } from "./cohort-retention-table"
import { useCohortReport, type CohortFilters } from "./use-cohort-report"
import type { CohortKind } from "./cohort-report-data"
import { ReportDetails } from "./report-layout"
import { ReportTableLoading } from "./report-visual-loading"

export function CohortReport({ kind, ...filters }: CohortFilters & { kind: CohortKind }) {
  const { data, error, isLoading, isValidating, mutate, authLoading, signedIn, hasSite, invalidDates } = useCohortReport(kind, filters)
  if (invalidDates) return <ReportState state="error" message="Select a valid date range." />
  if (authLoading) return <ReportTableLoading label="Preparing cohort reports" />
  if (isLoading || isValidating) return <ReportTableLoading label="Loading cohort reports" />
  if (!signedIn) return <ReportState state="error" message="Sign in to view cohort reports." />
  if (!hasSite) return <ReportState state="empty" message="Select a site to view cohort reports." />
  if (error) return <ReportState state="error" message={error.message} onRetry={() => { void mutate() }} />
  if (!data) return <ReportTableLoading label="Loading cohort reports" />
  const rows = kind === "customers" ? data.salesCohorts : data.leadCohorts
  const hasData = rows.length > 0 || data.usageCohorts.length > 0
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {data.metadata?.observationEnd && <span>Observed through <span className="font-medium text-foreground">{data.metadata.observationEnd}</span></span>}
        <span>Weekly cohorts · UTC</span>
        <span>— Not observed <span className="mx-2" aria-hidden="true">/</span> 0% No recorded activity</span>
      </div>
      {data.metadata?.activityAvailable === false && <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
        {data.metadata.activityUnavailableReason || "Recorded activity is unavailable. Retention has not been estimated."}
      </p>}
      {!hasData ? <ReportState state="empty" message="No cohorts match the selected filters." /> : <>
        <CohortRetentionTable title={kind === "customers" ? "Repeat purchase retention" : "Lead engagement retention"}
          rows={rows} population={kind === "customers" ? "Customers" : "Leads"} />
        {kind === "customers" && <CohortRetentionTable title="Customer engagement retention" rows={data.usageCohorts} population="Customers" />}
      </>}
      <ReportDetails summary="Cohort definitions and coverage">
        {data.metadata?.definition && <p>{data.metadata.definition}</p>}
        {kind === "leads" && data.metadata?.activityDefinition && <p>{data.metadata.activityDefinition}</p>}
        {kind === "customers" && data.metadata?.usageDefinition && <p>{data.metadata.usageDefinition}</p>}
        <p>Weeks start on Monday (UTC); incomplete follow-up weeks are not scored.</p>
        {kind === "customers" && <p>Confirmed sales do not represent cash receipts.</p>}
        {!!data.metadata?.excludedAnonymousSales && <p>{data.metadata.excludedAnonymousSales.toLocaleString("en-US")} sales without an identified customer were excluded; anonymous purchases cannot establish repeat customers.</p>}
      </ReportDetails>
    </div>
  )
}