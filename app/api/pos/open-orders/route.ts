import { NextResponse } from "next/server";
import { requirePosSiteAccess } from "@/app/pos/actions/site-access";
import { listPosOpenOrders } from "@/app/pos/actions/list-open-orders";
import { parsePosOrdersRead, posOrdersReadInput } from "@/app/pos/read-contract";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = posOrdersReadInput.safeParse(Object.fromEntries(params));
  if (!input.success || params.getAll("siteId").length !== 1) {
    return NextResponse.json({ error: "Invalid POS orders request" }, { status: 400, headers });
  }
  try {
    const access = await requirePosSiteAccess(input.data.siteId);
    if (!("supabase" in access)) {
      return NextResponse.json({ error: "Orders access unavailable" }, {
        status: access.error === "Not authenticated" ? 401 : 403, headers,
      });
    }
    const result = await listPosOpenOrders(input.data.siteId);
    const data = parsePosOrdersRead(result, input.data.siteId);
    if (data) return NextResponse.json({ data }, { headers });
  } catch { /* Keep provider and authorization internals server-side. */ }
  return NextResponse.json({ error: "Unable to load open POS orders" }, { status: 503, headers });
}