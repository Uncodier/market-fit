import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createMainClient, createServiceClient } from "@/lib/supabase/server"
import { getApiKeyFromRequest, isValidApiKey } from "@/app/lib/api-keys-config"
import { isSiteManagerRole } from "@/lib/auth/api-site-access"

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function checkManagerAccess(
  supabase: Awaited<ReturnType<typeof createMainClient>>,
  siteId: string
) {
  const { data: role, error } = await supabase.rpc("current_user_site_role", { p_site_id: siteId })
  if (error) {
    return NextResponse.json({ error: "Failed to verify site access" }, { status: 500 })
  }
  return isSiteManagerRole(role)
    ? null
    : NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

    const idParameters = ["siteId", "tenantId", "requirementId", "robotInstanceId"]
    if (idParameters.some((name) => searchParams.has(name) && (
      searchParams.getAll(name).length !== 1 || !UUID_PATTERN.test(searchParams.get(name) || "")
    ))) {
      return NextResponse.json({ error: "Invalid identifier parameter" }, { status: 400 })
    }
    if ((tenantId || requirementId) && idParameters.filter((name) => searchParams.has(name)).length !== 1) {
      return NextResponse.json({ error: "Conflicting identifier parameters" }, { status: 400 })
    }
    const sort = searchParams.get("sort") || "newest"
    if (searchParams.getAll("sort").length > 1 || !["newest", "oldest", "updated_at"].includes(sort)) {
      return NextResponse.json({ error: "Invalid sort parameter" }, { status: 400 })
    }

    // 1. Authenticate (Dual Auth: API Key or User Cookie)
    const apiKey = getApiKeyFromRequest(request.headers)
    const isServerRequest = isValidApiKey(apiKey)

    let mainSupabase;
    if (!isServerRequest) {
      mainSupabase = await createMainClient(true)
      const { data: { user }, error: authError } = await mainSupabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else {
      mainSupabase = await createServiceClient(true)
    }

    // Authorize the requirement even when its optional repository tenant is absent.
    let requirementSiteId: string | null = null
    if (requirementId) {
      const { data: requirement, error: requirementError } = await mainSupabase
        .from("requirements")
        .select("site_id")
        .eq("id", requirementId)
        .maybeSingle()

      if (requirementError) {
        return NextResponse.json({ error: "Failed to fetch requirement" }, { status: 500 })
      }
      if (!requirement?.site_id) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 })
      }
      requirementSiteId = requirement.site_id
      if (!isServerRequest) {
        const accessError = await checkManagerAccess(mainSupabase, requirement.site_id)
        if (accessError) return accessError
      }
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
        
      if (error) {
        return NextResponse.json({ error: "Failed to fetch tenant" }, { status: 500 })
      }
      if (!data) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
      }
      if (!isServerRequest) {
        const accessError = await checkManagerAccess(mainSupabase, data.site_id)
        if (accessError) return accessError
      }
      return NextResponse.json({ schema: data.schema })
    }

    if (requirementId) {
      const { data, error } = await reposSupabase
        .from("apps_tenants")
        .select("tenant_id, schema, bucket, site_id")
        .eq("requirement_id", requirementId)
        .maybeSingle()
        
      if (error) {
        return NextResponse.json({ error: "Failed to fetch tenant" }, { status: 500 })
      }
      if (!data) {
        // A requirement need not provision an application database. Keep the DTO
        // shape so Robots can use its generic database view without a failed read.
        return NextResponse.json({ tenant_id: null, schema: null, bucket: null })
      }
      if (data.site_id !== requirementSiteId) {
        return NextResponse.json({ error: "Tenant site mismatch" }, { status: 500 })
      }
      return NextResponse.json({
        tenant_id: data.tenant_id,
        schema: data.schema,
        bucket: data.bucket,
      })
    }

    if (siteId && !isServerRequest) {
      const accessError = await checkManagerAccess(mainSupabase, siteId)
      if (accessError) return accessError
    }

    if (robotInstanceId && !isServerRequest) {
      const { data: instance, error: instanceError } = await mainSupabase
        .from("remote_instances")
        .select("site_id")
        .eq("id", robotInstanceId)
        .maybeSingle()

      if (instanceError) {
        return NextResponse.json({ error: "Failed to fetch robot instance" }, { status: 500 })
      }
      if (!instance?.site_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const accessError = await checkManagerAccess(mainSupabase, instance.site_id)
      if (accessError) return accessError
    }

    // First get the requirements for this site from the main database
    let requirementsQuery = mainSupabase
      .from("requirements")
      .select("id, title, status, created_at, updated_at")
      
    if (robotInstanceId) {
      // If we have an instance ID, we only want requirements tied to this instance
      const { data: instanceStatuses, error: statusError } = await mainSupabase
        .from('requirement_status')
        .select('requirement_id')
        .eq('instance_id', robotInstanceId)

      if (statusError) {
        return NextResponse.json({ error: "Failed to fetch requirement statuses" }, { status: 500 })
      }
        
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
      return NextResponse.json({ error: "Failed to fetch tenants" }, { status: 500 })
    }

    // Group tenants by requirement_id
    const tenantsByRequirement = new Map<string, TenantSummary[]>()
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

  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
