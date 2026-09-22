import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getApiKeyFromRequest, isValidApiKey } from "@/app/lib/api-keys-config"
import {
  getCurrentUserSiteRole,
  isSiteManagerRole,
} from "@/lib/auth/api-site-access"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schema = searchParams.get("schema")

  if (!schema) {
    return NextResponse.json({ error: "Missing schema parameter" }, { status: 400 })
  }

  // 1. Authenticate (Dual Auth: API Key or User Cookie)
  const apiKey = getApiKeyFromRequest(request.headers)
  const isServerRequest = isValidApiKey(apiKey)
  const mainSupabase = isServerRequest ? null : await createClient()

  if (mainSupabase) {
    const { data: { user }, error: authError } = await mainSupabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const repositoriesUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL
    const repositoriesKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY
    if (!repositoriesUrl || !repositoriesKey) {
      return NextResponse.json(
        { error: "Repositories database not configured" },
        { status: 500 }
      )
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js")
    const reposSupabase = createSupabaseClient(repositoriesUrl, repositoriesKey)
    const { data: tenantData, error: tenantError } = await reposSupabase
      .from("apps_tenants")
      .select("tenant_id, site_id, schema")
      .eq("schema", schema)
      .maybeSingle()

    if (tenantError || !tenantData) {
      return NextResponse.json({ error: "Tenant not found for schema" }, { status: 404 })
    }

    if (mainSupabase) {
      const role = await getCurrentUserSiteRole(mainSupabase, tenantData.site_id)
      if (!isSiteManagerRole(role)) {
        return NextResponse.json(
          { error: "Forbidden: User does not have access to this tenant" },
          { status: 403 }
        )
      }
    }

    // 2. Introspect schema using our custom RPC function
    // This bypasses the need for PostgREST to have the schema exposed directly
    // which can be buggy in Supabase when dynamically creating schemas
    const { data: introspectData, error: introspectError } = await reposSupabase
      .rpc("introspect_schema_tables", { schema_name: tenantData.schema })

    if (introspectError) {
      console.error(`Error introspecting schema ${schema} via RPC:`, introspectError)
      return NextResponse.json({ error: "Failed to introspect schema tables." }, { status: 500 })
    }

    const { data: countsData, error: countsError } = await reposSupabase
      .rpc("get_schema_table_counts", { schema_name: tenantData.schema })

    if (countsError) {
      console.error(`Error getting table counts for schema ${schema} via RPC:`, countsError)
    }

    const tables = introspectData || []
    const counts = countsData || {}

    // Map the results
    const result = tables.map((tableDef: any) => {
      const tableName = tableDef.name
      const tableColumns = tableDef.columns || []
      
      const primaryKeyCol = tableColumns.find((c: any) => c.is_primary)

      return {
        name: tableName,
        schema: tenantData.schema,
        columns: tableColumns,
        primaryKey: primaryKeyCol ? primaryKeyCol.name : null,
        count: counts[tableName] || 0
      }
    })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("Unexpected error in introspection:", err)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
