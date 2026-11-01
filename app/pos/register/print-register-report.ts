import type { PrintersSettings } from "@/lib/printer"
import { registerReportSummary } from "@/lib/printer/core/register-report"
import { printPosJobManually } from "../manual-print"
import type { RegisterSession, RegisterSummary } from "./types"

export async function printRegisterReport(
  session: RegisterSession,
  summary: RegisterSummary,
  locationName: string,
  settings: PrintersSettings,
): Promise<"printer" | "system"> {
  const sentAt = new Date().toISOString()
  return printPosJobManually(settings, {
    id: `manual-register-report-${session.id}-${sentAt}`,
    module: "pos",
    template: "register-report",
    sentAt,
    payload: {
      session,
      summary: registerReportSummary({ session, summary, locationName }),
      locationName,
    },
  })
}
