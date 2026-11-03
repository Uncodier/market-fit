import type { RegisterSession, RegisterSummary } from "@/app/pos/register/types"

/** Audit data, not synthetic receipt products or payment lines. */
export interface RegisterReportPayload {
  session: RegisterSession
  summary: RegisterSummary
  locationName: string
  includeTransactions?: boolean
}