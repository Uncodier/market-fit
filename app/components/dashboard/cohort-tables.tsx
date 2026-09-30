"use client"

import { CohortReport } from "./cohort-report"
import type { CohortFilters } from "./use-cohort-report"

export function CohortTables(props: CohortFilters) {
  return <CohortReport kind="customers" {...props} />
}