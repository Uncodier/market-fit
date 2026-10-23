import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { getPosCatalogRevision } from "@/app/pos/actions/sync-revision";

const siteSchema = z.string().uuid().or(z.string().max(128).regex(/^demo-[a-zA-Z0-9-]+$/));
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = siteSchema.safeParse(url.searchParams.get("siteId"));
  if (!input.success || url.searchParams.getAll("siteId").length !== 1) {
    return NextResponse.json({ error: "Invalid catalog revision request" }, { status: 400, headers });
  }
  try {
    // Middleware does not authorize APIs. Check the actor and site here before
    // calling the existing revision reader, which also guards its cache access.
    const access = await requirePosSiteAccess(input.data);
    if (!("supabase" in access)) {
      return NextResponse.json({ error: "Catalog access unavailable" }, {
        status: access.error === "Not authenticated" ? 401 : 403, headers,
      });
    }
    const result = await getPosCatalogRevision(input.data);
    if ("error" in result) {
      return NextResponse.json({ error: "Unable to check the catalog revision" }, { status: 503, headers });
    }
    return NextResponse.json({ data: result.data }, { headers });
  } catch {
    return NextResponse.json({ error: "Unable to check the catalog revision" }, { status: 503, headers });
  }
}