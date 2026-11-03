import { NextResponse } from "next/server";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { pullPosCatalogSnapshot } from "@/app/pos/actions/pull-snapshot";
import { parsePosCatalogRead, posCatalogReadInput } from "@/app/pos/read-contract";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = posCatalogReadInput.safeParse(Object.fromEntries(params));
  if (!input.success || Array.from(params.keys()).some((key) => params.getAll(key).length !== 1)) {
    return NextResponse.json({ error: "Invalid POS catalog request" }, { status: 400, headers });
  }
  try {
    // API middleware is not an authorization boundary. Reuse the complete POS
    // actor, tenant and unrestricted-location gate before accessing any cache.
    const access = await requirePosSiteAccess(input.data.siteId);
    if (!("supabase" in access)) {
      return NextResponse.json({ error: "Catalog access unavailable" }, {
        status: access.error === "Not authenticated" ? 401 : 403, headers,
      });
    }
    const result = await pullPosCatalogSnapshot(input.data.siteId, input.data.revision, input.data.bypassCache === "true");
    const data = parsePosCatalogRead(result, input.data.siteId);
    if (data) return NextResponse.json({ data }, { headers });
  } catch { /* Do not expose provider, cache or validation details. */ }
  return NextResponse.json({ error: "Unable to load the POS catalog" }, { status: 503, headers });
}