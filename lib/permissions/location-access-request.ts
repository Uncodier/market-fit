import "server-only"
import { NextResponse } from "next/server"
import { restrictedLocationIdsSchema } from "./location-access"

/** Legacy member endpoints must not silently accept a restriction request without persisting it. */
export function rejectPrematureLocationRestrictions(body: Record<string, unknown>) {
  if (!("restricted_location_ids" in body)) return null
  if (!restrictedLocationIdsSchema.safeParse(body.restricted_location_ids).success) {
    return NextResponse.json({ success: false, error: "Invalid location restrictions" }, { status: 400 })
  }
  return NextResponse.json({ success: false, code: "LOCATION_RESTRICTIONS_USE_DEDICATED_ENDPOINT",
    error: "Save location restrictions through the dedicated location restriction endpoint" }, { status: 409 })
}