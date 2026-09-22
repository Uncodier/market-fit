import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createMainClient, createServiceClient } from "@/lib/supabase/server"
import { getApiKeyFromRequest, isValidApiKey } from "@/app/lib/api-keys-config"
import {
  getCurrentUserSiteRole,
  isSiteManagerRole,
} from "@/lib/auth/api-site-access"

interface RequirementSummary {
  id: string
  title: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

interface TenantSummary {
  tenant_id: string
  schema: string
  bucket: string
}

type RequirementWithTenants = RequirementSummary & {
  apps_tenants: TenantSummary[]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siteId = searchParams.get("siteId")
    const tenantId = searchParams.get("tenantId")
    const requirementId = searchParams.get("requirementId")
    const robotInstanceId = searchParams.get("robotInstanceId")

    if (!siteId && !tenantId && !requirementId && !robotInstanceId) {
      return NextResponse.json({ error: "Missing siteId, tenantId, requirementId or robotInstanceId parameter" }, { status: 400 })
    }

    // 1. Authenticate (Dual Auth: API Key or User Cookie)
    const apiKey = getApiKeyFromRequest(request.headers)
    const isServerRequest = isValidApiKey(apiKey)

    let mainSupabase;
    if (!isServerRequest) {
      mainSupabase = await createMainClient()
      const { data: { user } } = await mainSupabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else {
      mainSupabase = await createServiceClient()
    }

    // Connect to repositories DB
    const repositoriesUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    const repositoriesKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY

    if (!repositoriesUrl || !repositoriesKey) {
      return NextResponse.json({ error: "Repositories database not configured" }, { status: 500 })
    }

    const reposSupabase = createClient(repositoriesUrl, repositoriesKey)

    if (tenantId) {
      const { data, error } = await reposSupabase
        .from("apps_tenants")
        .select("schema, site_id")
        .eq("tenant_id", tenantId)
        .maybeSingle()
        
      if (error || !data) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
      }
      if (!isServerRequest) {
        const role = await getCurrentUserSiteRole(mainSupabase, data.site_id)
        if (!isSiteManagerRole(role)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      return NextResponse.json({ schema: data.schema })
    }

    if (requirementId) {
      const { data, error } = await reposSupabase
        .from("apps_tenants")
        .select("tenant_id, schema, bucket, site_id")
        .eq("requirement_id", requirementId)
        .maybeSingle()
        
      if (error || !data) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
      }
      if (!isServerRequest) {
        const role = await getCurrentUserSiteRole(mainSupabase, data.site_id)
        if (!isSiteManagerRole(role)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
      return NextResponse.json({
        tenant_id: data.tenant_id,
        schema: data.schema,
        bucket: data.bucket,
      })
    }

    if (siteId && !isServerRequest) {
      const role = await getCurrentUserSiteRole(mainSupabase, siteId)
      if (!isSiteManagerRole(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    if (robotInstanceId && !isServerRequest) {
      const { data: instance, error: instanceError } = await mainSupabase
        .from("remote_instances")
        .select("site_id")
        .eq("id", robotInstanceId)
        .maybeSingle()

      if (instanceError || !instance?.site_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const role = await getCurrentUserSiteRole(mainSupabase, instance.site_id)
      if (!isSiteManagerRole(role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // First get the requirements for this site from the main database
    let requirementsQuery = mainSupabase
      .from("requirements")
      .select("id, title, status, created_at, updated_at")
      
    if (robotInstanceId) {
      // If we have an instance ID, we only want requirements tied to this instance
      const { data: instanceStatuses } = await mainSupabase
        .from('requirement_status')
        .select('requirement_id')
        .eq('instance_id', robotInstanceId)
        
      const instanceReqIds = (instanceStatuses || []).map(
        (status: { requirement_id: string }) => status.requirement_id
      )
      
      if (instanceReqIds.length > 0) {
        requirementsQuery = requirementsQuery.in('id', instanceReqIds)
      } else {
        return NextResponse.json({ tenants: [] })
      }
    } else {
      requirementsQuery = requirementsQuery.eq("site_id", siteId)
    }
      
    const { data: requirements, error: reqError } = await requirementsQuery

    if (reqError) {
      console.error("Error fetching requirements:", reqError)
      return NextResponse.json({ error: "Failed to fetch requirements" }, { status: 500 })
    }

    const requirementIds = (requirements || []).map(
      (requirement: RequirementSummary) => requirement.id
    )

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
    const merged: RequirementWithTenants[] = (requirements || [])
      .map((requirement: RequirementSummary) => ({
        ...requirement,
        apps_tenants: tenantsByRequirement.get(requirement.id) ?? [],
      }))
      .filter((application: RequirementWithTenants) =>
        application.apps_tenants.length > 0
      )

    const sort = searchParams.get("sort") || "newest"
    merged.sort((a: RequirementWithTenants, b: RequirementWithTenants) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      const updateA = new Date(a.updated_at || a.created_at || 0).getTime()
      const updateB = new Date(b.updated_at || b.created_at || 0).getTime()
      
      if (sort === 'oldest') return dateA - dateB
      if (sort === 'updated_at') return updateB - updateA
      return dateB - dateA // newest (default)
    })

    return NextResponse.json({
      tenants: merged
    })

  } catch (error) {
    console.error("Error in tenants API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
