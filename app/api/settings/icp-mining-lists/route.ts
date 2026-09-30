import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"

const uuid = z.string().uuid().transform(value => value.toLowerCase())
const listSchema = z.object({
  id: uuid,
  name: z.string().nullable(),
  status: z.enum(["pending", "running"]),
  total_targets: z.number().nullable(),
  processed_targets: z.number().nullable(),
  progress_percent: z.union([z.string(), z.number()]).nullable(),
})
const headers = { "Cache-Control": "private, no-store" }

/** Read only: authorize the site before using elevated access for unsegmented lists. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const site = uuid.safeParse(params.get("site_id"))
    const after = params.has("after") ? uuid.safeParse(params.get("after")) : undefined
    if (!site.success || (after && !after.success)
      || params.getAll("site_id").length !== 1 || params.getAll("after").length > 1) {
      return NextResponse.json({ error: "Invalid site or mining list cursor" }, { status: 400, headers })
    }
    const access = await requireSiteAccess(request, site.data)
    if (access.error) return access.error

    // Existing browser RLS is based on role-query segments, which can omit valid
    // pending lists without segments. Membership is checked above; ownership below.
    const supabase = await createServiceClient(true)
    let query = supabase.from("icp_mining")
      .select("id, name, status, total_targets, processed_targets, progress_percent")
      .eq("site_id", site.data).in("status", ["pending", "running"])
      .order("id", { ascending: true }).limit(200)
    if (after?.success) query = query.gt("id", after.data)
    const { data, error } = await query
    if (error) throw new Error("Mining list read failed")
    const lists = z.array(listSchema).parse(data)
    return NextResponse.json({ lists, next_cursor: lists.at(-1)?.id ?? null }, { headers })
  } catch {
    return NextResponse.json({ error: "Unable to load mining lists" }, { status: 500, headers })
  }
}