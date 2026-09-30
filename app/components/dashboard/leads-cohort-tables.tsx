"use client"

import { CohortReport } from "./cohort-report"
import type { CohortFilters } from "./use-cohort-report"

export function LeadsCohortTables(props: CohortFilters) {
  return <CohortReport kind="leads" {...props} />
}