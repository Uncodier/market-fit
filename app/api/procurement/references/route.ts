import { NextResponse } from "next/server"
import { z } from "zod"
import { privateHeaders, procurementAccess, procurementError } from "../http"

const inputSchema = z.object({
  kind: z.enum(["people", "products", "categories", "agents"]),
  q: z.string().trim().max(100).default(""),
})

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const input = inputSchema.safeParse({ kind: params.get("kind"), q: params.get("q") ?? "" })
    if (!input.success || params.getAll("kind").length !== 1 || params.getAll("q").length > 1) {
      return procurementError("Invalid reference search", 400)
    }
    const access = await procurementAccess(request)
    if (access.error) return access.error
    const { supabase, siteId } = access
    const search = input.data.q.replace(/[\\%_]/g, "\\$&")
    if (input.data.kind === "people") {
      let query = supabase.from("site_members").select("user_id, name")
        .eq("site_id", siteId).eq("status", "active")
        .eq("license_suspended", false).eq("manually_disabled", false)
        .not("user_id", "is", null).order("name").limit(51)
      if (search) query = query.ilike("name", `%${search}%`)
      const [members, owner] = await Promise.all([
        query,
        supabase.from("sites").select("user_id").eq("id", siteId).single(),
      ])
      if (members.error || owner.error) throw new Error("Reference lookup failed")
      const options = new Map<string, { id: string; label: string }>()
      if (owner.data?.user_id && (!search || "workspace owner".includes(input.data.q.toLowerCase()))) {
        options.set(owner.data.user_id, { id: owner.data.user_id, label: "Workspace owner" })
      }
      for (const row of members.data ?? []) {
        if (row.user_id) options.set(row.user_id, { id: row.user_id, label: row.name || "Workspace member" })
      }
      return NextResponse.json({ options: [...options.values()].slice(0, 50),
        has_more: (members.data?.length ?? 0) > 50 || options.size > 50 }, { headers: privateHeaders })
    }
    const table = { products: "catalog_items", categories: "catalog_categories", agents: "agents" }[input.data.kind]
    let query = supabase.from(table).select("id, name").eq("site_id", siteId)
      .order("name").limit(51)
    if (search) query = query.ilike("name", `%${search}%`)
    const { data, error } = await query
    if (error) throw new Error("Reference lookup failed")
    return NextResponse.json({ options: (data ?? []).slice(0, 50).map((row: { id: string; name: string }) => ({
      id: row.id, label: row.name,
    })), has_more: (data?.length ?? 0) > 50 }, { headers: privateHeaders })
  } catch {
    return procurementError("Unable to load workspace references", 503)
  }
}