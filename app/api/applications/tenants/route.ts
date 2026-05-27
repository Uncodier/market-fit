import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createMainClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const tenantId = searchParams.get("tenantId")

    if (!siteId && !tenantId) {
      return NextResponse.json({ error: "Missing siteId or tenantId parameter" }, { status: 400 })
    }

    // Verify auth
    const mainSupabase = await createMainClient()
    const { data: { user } } = await mainSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Connect to repositories DB
    const repositoriesUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    const repositoriesKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY

    if (!repositoriesUrl || !repositoriesKey) {
      return NextResponse.json({ error: "Repositories database not configured" }, { status: 500 })
    }

    const reposSupabase = createClient(repositoriesUrl, repositoriesKey)

    if (tenantId) {
      // Just fetch the tenant by ID
      const { data, error } = await reposSupabase
        .from("apps_tenants")
        .select("schema")
        .eq("tenant_id", tenantId)
        .single()
        
      if (error) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
      }
      return NextResponse.json(data)
    }

    // First get the requirements for this site from the main database
    const { data: requirements, error: reqError } = await mainSupabase
      .from("requirements")
      .select("id, title, status")
      .eq("site_id", siteId)

    if (reqError) {
      console.error("Error fetching requirements:", reqError)
      return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 })
    }

    const requirementIds = (requirements || []).map(r => r.id)

    if (requirementIds.length === 0) {
      return NextResponse.json({ tenants: [] })
    }

    // Then get the tenants from the repositories database
    const { data: tenants, error: tenantsError } = await reposSupabase
      .from("apps_tenants")
      .select("requirement_id, tenant_id, schema, bucket")
      .in("requirement_id", requirementIds)

    if (tenantsError) {
      console.error("Error fetching tenants from repos DB:", tenantsError)
      return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 })
    }

    // Group tenants by requirement_id
    const tenantsByRequirement = new Map<string, any[]>()
    for (const tenant of (tenants || [])) {
      const list = tenantsByRequirement.get(tenant.requirement_id) ?? []
      list.push({
        tenant_id: tenant.tenant_id,
        schema: tenant.schema,
        bucket: tenant.bucket,
      })
      tenantsByRequirement.set(tenant.requirement_id, list)
    }

    // Merge tenants into requirements
    const merged = (requirements || [])
      .map((req) => ({
        ...req,
        apps_tenants: tenantsByRequirement.get(req.id) ?? [],
      }))
      .filter(app => app.apps_tenants.length > 0)

    return NextResponse.json({
      tenants: merged
    })

  } catch (error) {
    console.error("Error in tenants API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
