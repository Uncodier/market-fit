"use server"

import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

// Create a client for the repositories database with the service role key
function getReposClient(schema: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_REPOSITORIES_SUPABASE_URL!
  const supabaseKey = process.env.REPOSITORIES_SUPABASE_SECRET_KEY!
  
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })
  
  return client.schema(schema)
}

export async function updateTableRow({
  schema,
  table,
  primaryKey,
  primaryKeyValue,
  data
}: {
  schema: string
  table: string
  primaryKey: string
  primaryKeyValue: any
  data: Record<string, any>
}) {
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    
    if (!user) {
      throw new Error("Unauthorized")
    }
    
    const client = getReposClient('public')
    
    const { data: rpcData, error } = await client.rpc('update_schema_table_row', {
      schema_name: schema,
      table_name: table,
      pk_col: primaryKey,
      pk_val: String(primaryKeyValue),
      update_data: data
    })
      
    if (error) {
      console.error("Supabase update error:", error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (error: any) {
    console.error("Error updating table row:", error)
    return { error: error.message || "Failed to update row" }
  }
}

export async function insertTableRow({
  schema,
  table,
  data
}: {
  schema: string
  table: string
  data: Record<string, any>
}) {
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    
    if (!user) {
      throw new Error("Unauthorized")
    }
    
    const client = getReposClient('public')
    
    const { data: rpcData, error } = await client.rpc('insert_schema_table_row', {
      schema_name: schema,
      table_name: table,
      insert_data: data
    })
      
    if (error) {
      console.error("Supabase insert error:", error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (error: any) {
    console.error("Error inserting table row:", error)
    return { error: error.message || "Failed to insert row" }
  }
}

export async function fetchTableData({
  schema,
  table,
  page,
  pageSize,
  primaryKey,
  filters = [],
  sorts = []
}: {
  schema: string
  table: string
  page: number
  pageSize: number
  primaryKey: string | null
  filters?: { column: string; operator: string; value: any }[]
  sorts?: { column: string; ascending: boolean }[]
}) {
  try {
    // Basic auth check
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    
    if (!user) {
      throw new Error("Unauthorized")
    }
    
    const client = getReposClient('public')
    
    const { data: rpcData, error } = await client.rpc('select_schema_table', {
      schema_name: schema,
      table_name: table,
      query_filters: filters,
      query_sorts: sorts,
      page_num: page,
      page_size: pageSize
    })
    
    if (error) {
      console.error("Supabase query error:", error)
      throw new Error(error.message)
    }
    
    return { 
      data: rpcData?.data || [], 
      count: rpcData?.count || 0 
    }
  } catch (error: any) {
    console.error("Error fetching table data:", error)
    return { error: error.message || "Failed to fetch data" }
  }
}

export async function deleteTableRows({
  schema,
  table,
  primaryKey,
  primaryKeyValues
}: {
  schema: string
  table: string
  primaryKey: string
  primaryKeyValues: any[]
}) {
  try {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()
    
    if (!user) {
      throw new Error("Unauthorized")
    }
    
    const client = getReposClient('public')
    
    const { data: rpcData, error } = await client.rpc('delete_schema_table_rows', {
      schema_name: schema,
      table_name: table,
      pk_col: primaryKey,
      pk_vals: primaryKeyValues
    })
      
    if (error) {
      console.error("Supabase delete error:", error)
      throw new Error(error.message)
    }
    
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting table rows:", error)
    return { error: error.message || "Failed to delete rows" }
  }
}

