import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"

export const privateHeaders = { "Cache-Control": "private, no-store" }
export const uuid = z.string().uuid().transform(value => value.toLowerCase())

export function procurementError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: privateHeaders })
}

export async function procurementAccess(request: Request) {
  const params = new URL(request.url).searchParams
  const site = uuid.safeParse(params.get("site_id"))
  if (!site.success || params.getAll("site_id").length !== 1) {
    return { error: procurementError("A valid workspace is required", 400) } as const
  }
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get("cookie") ?? "")) {
    return { error: procurementError("Procurement configuration is unavailable in demo mode", 403) } as const
  }
  const access = await requireSiteAccess(request, site.data, { requireManager: true })
  if (access.error) {
    access.error.headers.set("Cache-Control", "private, no-store")
    return { error: access.error } as const
  }
  return { ...access, siteId: site.data } as const
}