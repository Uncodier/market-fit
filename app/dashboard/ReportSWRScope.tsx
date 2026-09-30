"use client"

import type { ReactNode } from "react"
import { SWRConfig } from "swr"

// Functional config replaces inherited error-masking middleware. Reports must not
// treat failed refreshes as current data or persist another account's analytics.
const reportConfig = () => ({
  provider: () => new Map(),
  use: [],
  keepPreviousData: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
  dedupingInterval: 30_000,
})

export function ReportSWRScope({ children }: { children: ReactNode }) {
  return <SWRConfig value={reportConfig}>{children}</SWRConfig>
}