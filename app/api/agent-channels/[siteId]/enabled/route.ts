import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"

const inputSchema = z.object({
  connectionId: z.string().trim().min(1).max(200),
  enabled: z.boolean(),
}).strict()

const resultSchema = z.object({
  success: z.literal(true),
  channels: z.object({ connections: z.array(z.object({ id: z.string().optional() }).passthrough()) }).passthrough(),
})

function failure(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params
    if (!z.string().uuid().safeParse(siteId).success) return failure("Invalid site", 400)
    const access = await requireSiteAccess(request, siteId, { requireManager: true })
    if (access.error) return access.error
    const input = inputSchema.safeParse(await request.json().catch(() => null))
    if (!input.success) return failure("Invalid channel activation request", 400)

    // The authenticated actor is reauthorized under the database's site lock.
    const database = await createServiceClient(true)
    const { data, error } = await database.rpc("set_site_agent_channel_enabled", {
      p_site_id: siteId,
      p_connection_id: input.data.connectionId,
      p_enabled: input.data.enabled,
      p_actor_id: access.userId,
    })
    if (error) {
      if (error.code === "42501") return failure("Forbidden", 403)
      if (error.code === "22023") return failure("Channel is unavailable or cannot be activated", 409)
      if (["PGRST202", "42883", "40001"].includes(error.code || "")) {
        return failure("Channel activation is temporarily unavailable. Please retry.", 503)
      }
      return failure("Could not update channel activation", 500)
    }
    if (data?.success === false && data?.code === "ACCOUNT_LIMIT") {
      return NextResponse.json({ success: false, error: {
        code: "ACCOUNT_LIMIT",
        message: "Account limit reached. Disable another account, upgrade your plan, or purchase an account add-on.",
      } }, { status: 409 })
    }
    const result = resultSchema.safeParse(data)
    if (!result.success || result.data.channels.connections.filter(row => row.id === input.data.connectionId).length !== 1) {
      return failure("Could not confirm channel activation", 503)
    }
    return NextResponse.json(result.data, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return failure("Could not update channel activation", 500)
  }
}