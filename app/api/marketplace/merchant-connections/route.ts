import { z } from "zod"
import { requireMerchantManager } from "@/lib/marketplace/merchant/access"
import { createServiceClient } from "@/lib/supabase/server"
import { authorizedStoreSchema } from "@/lib/marketplace/merchant/types"

export const runtime = "nodejs"
export async function GET(request: Request) {
  const siteId = new URL(request.url).searchParams.get("siteId")
  if (!z.string().uuid().safeParse(siteId).success) return Response.json({ error: "Invalid site" }, { status: 400 })
  const access = await requireMerchantManager(request, siteId!)
  if (access.error) return access.error
  try {
    const database = await createServiceClient(true)
    const { data, error } = await database.from("marketplace_merchant_connections")
      .select("id,provider,environment,country,credential_mode,status,authorized_stores,token_expires_at")
      .eq("site_id", siteId).eq("status", "authorized")
    if (error) throw new Error()
    const rows = z.array(z.object({ id: z.string().uuid(), provider: z.enum(["rappi", "uber_eats"]),
      environment: z.enum(["production", "sandbox"]), country: z.string(), credential_mode: z.enum(["platform", "custom"]),
      status: z.string(), authorized_stores: z.array(authorizedStoreSchema), token_expires_at: z.string().nullable(),
    })).parse(data || [])
    return Response.json({ connections: rows.map(row => ({
      id: row.id, provider: row.provider, environment: row.environment, country: row.country,
      credential_mode: row.credential_mode, status: row.status, stores: row.authorized_stores,
      authorization_expired: row.token_expires_at ? Date.parse(row.token_expires_at) <= Date.now() : false,
    })) }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return Response.json({ error: "Merchant connections unavailable" }, { status: 503 })
  }
}