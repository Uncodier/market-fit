import type { RegisterReportPayload } from "./register-report-types"

/** A supplied live summary can never stand in for an immutable closing record. */
export function registerReportSummary({ session, summary }: RegisterReportPayload) {
  if (session.status !== "closed") return summary
  if (!session.snapshot) {
    throw new Error("The closing snapshot is unavailable. Cannot print a closed register report.")
  }
  return session.snapshot
}