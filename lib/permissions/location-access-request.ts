import "server-only"
import { NextResponse } from "next/server"
import { restrictedLocationIdsSchema } from "./location-access"
import { LOCATION_ACCESS_ROLLOUT_MESSAGE } from "./location-access-rollout"

/** Legacy member endpoints must not silently accept a restriction request without persisting it. */
export function rejectPrematureLocationRestrictions(body: Record<string, unknown>) {
  if (!("restricted_location_ids" in body)) return null
  if (!restrictedLocationIdsSchema.safeParse(body.restricted_location_ids).success) {
    return NextResponse.json({ success: false, error: "Invalid location restrictions" }, { status: 400 })
  }
  return NextResponse.json({ success: false, code: "LOCATION_ACCESS_NOT_READY", error: LOCATION_ACCESS_ROLLOUT_MESSAGE }, { status: 409 })
}