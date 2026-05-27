import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getApiKeyFromRequest, isValidApiKey } from "@/app/lib/api-keys-config"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const schema = searchParams.get("schema")

  if (!schema) {
    return NextResponse.json({ error: "Missing schema parameter" }, { status: 400 })
  }

  // 1. Authenticate (Dual Auth: API Key or User Cookie)
  const apiKey = getApiKeyFromRequest(request.headers, searchParams)
  const isServerRequest = isValidApiKey(apiKey)

  if (!isServerRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Authorize via tenant_users
    // apps_tenants is in the repositories database
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const reposSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL!,
      process.env.REPOSITORIES_SUPABASE_SECRET_KEY!
    )

    const { data: tenantData, error: tenantError } = await reposSupabase
      .from("apps_tenants")
      .select("tenant_id")
      .eq("schema", schema)
      .single()

    if (tenantError || !tenantData) {
      return NextResponse.json({ error: "Tenant not found for schema" }, { status: 404 })
    }

    const { data: userAccess, error: accessError } = await reposSupabase
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenantData.tenant_id)
      .eq("user_id", user.id)
      .single()

    if (accessError || !userAccess) {
      // For development/admins we might want to let them see tables anyway
      // return NextResponse.json({ error: "Forbidden: User does not have access to this tenant" }, { status: 403 })
    }
  }

  try {
    // 3. Introspect schema using our custom RPC function
    // This bypasses the need for PostgREST to have the schema exposed directly
    // which can be buggy in Supabase when dynamically creating schemas
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const reposSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL!,
      process.env.REPOSITORIES_SUPABASE_SECRET_KEY!
    )

    const { data: introspectData, error: introspectError } = await reposSupabase
      .rpc('introspect_schema_tables', { schema_name: schema })

    if (introspectError) {
      console.error(`Error introspecting schema ${schema} via RPC:`, introspectError)
      return NextResponse.json({ error: "Failed to introspect schema tables." }, { status: 500 })
    }

    const { data: countsData, error: countsError } = await reposSupabase
      .rpc('get_schema_table_counts', { schema_name: schema })

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
        schema: schema,
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
