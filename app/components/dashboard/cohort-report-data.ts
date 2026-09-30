export type CohortKind = "customers" | "leads"
export type CohortRow = {
  cohort: string
  cohortStart?: string
  size?: number
  weeks: (number | null)[]
}

export type CohortMetadata = {
  definition?: string
  usageDefinition?: string
  activityDefinition?: string
  activityAvailable?: boolean
  activityUnavailableReason?: string
  observationEnd?: string
  startDate?: string
  endDate?: string
  weekStartsOn?: string
  excludedAnonymousSales?: number
}

export type CohortReportData = {
  salesCohorts: CohortRow[]
  usageCohorts: CohortRow[]
  leadCohorts: CohortRow[]
  metadata?: CohortMetadata
}

export class CohortReportError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

function readRows(value: unknown): CohortRow[] {
  if (!Array.isArray(value)) throw new CohortReportError("The cohort report is incomplete. Please try again.")
  const names = new Set<string>()
  return value.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new CohortReportError("Invalid cohort data.")
    const item = row as Record<string, unknown>
    if (typeof item.cohort !== "string" || !item.cohort.trim() || names.has(item.cohort) ||
      !Array.isArray(item.weeks) || item.weeks.length > 54 || !item.weeks.every((value: unknown) =>
        value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)) ||
      (item.size !== undefined && (!Number.isSafeInteger(item.size) || Number(item.size) <= 0))) {
      throw new CohortReportError("Invalid cohort data.")
    }
    names.add(item.cohort)
    return {
      cohort: item.cohort,
      cohortStart: typeof item.cohortStart === "string" ? item.cohortStart : undefined,
      size: typeof item.size === "number" ? item.size : undefined,
      weeks: item.weeks as (number | null)[],
    }
  })
}

export function parseCohortReport(payload: unknown, kind: CohortKind): CohortReportData {
  if (!payload || typeof payload !== "object" || "error" in payload) {
    throw new CohortReportError("The cohort report is incomplete. Please try again.")
  }
  const body = payload as Record<string, unknown>
  const metadata: CohortMetadata = {}
  if (body.metadata && typeof body.metadata === "object") {
    const source = body.metadata as Record<string, unknown>
    for (const key of ["definition", "usageDefinition", "activityDefinition", "activityUnavailableReason", "observationEnd", "startDate", "endDate", "weekStartsOn"] as const) {
      if (typeof source[key] === "string") metadata[key] = source[key]
    }
    if (typeof source.activityAvailable === "boolean") metadata.activityAvailable = source.activityAvailable
    if (Number.isSafeInteger(source.excludedAnonymousSales) && Number(source.excludedAnonymousSales) >= 0) {
      metadata.excludedAnonymousSales = Number(source.excludedAnonymousSales)
    }
  }
  return {
    salesCohorts: kind === "customers" ? readRows(body.salesCohorts) : [],
    usageCohorts: kind === "customers" ? readRows(body.usageCohorts) : [],
    leadCohorts: kind === "leads" ? readRows(body.leadCohorts) : [],
    metadata,
  }
}