import { NextResponse } from "next/server"
import { TrafficSessionLimitError } from "./session-loader"

export function trafficReportError(error: unknown, report: string): NextResponse {
  if (error instanceof TrafficSessionLimitError) {
    return NextResponse.json({
      error: error.message,
      code: "TRAFFIC_SESSION_LIMIT_EXCEEDED",
      maxSessions: 50_000,
    }, { status: 422 })
  }
  return NextResponse.json({ error: `Unable to load ${report} report` }, { status: 500 })
}

export function rejectTrafficSegmentFilter(request: Request): NextResponse | null {
  const segmentId = new URL(request.url).searchParams.get("segmentId")
  return segmentId && segmentId !== "all"
    ? NextResponse.json({
      error: "Segment filtering is not available for this report. Select all segments.",
    }, { status: 422 })
    : null
}