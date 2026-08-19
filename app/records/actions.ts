"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type RecordCategory = {
  id: string
  site_id: string
  name: string
  description: string | null
  icon: string | null
  parent_category_id?: string | null
  template_fields: any[] // array of fields
  created_at: string
  updated_at: string
}

export type RecordItem = {
  id: string
  site_id: string
  category_id: string
  title: string
  description: string | null
  data: Record<string, any>
  relations: Record<string, any>
  status: string
  created_at: string
  updated_at: string
  category?: RecordCategory
}

// ----------------------------------------------------------------------------
// Record Categories
// ----------------------------------------------------------------------------

export async function getRecordCategories(siteId: string): Promise<{ categories: RecordCategory[] | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from("record_categories")
      .select("*")
      .eq("site_id", siteId)
      .order("created_at", { ascending: true })

    if (error) throw error
    return { categories: data as RecordCategory[], error: null }
  } catch (error: any) {
    console.error("Error in getRecordCategories:", error)
    return { categories: null, error: error.message || "Failed to fetch categories" }
  }
}

export async function createRecordCategory({
  site_id,
  name,
  description,
  icon,
  parent_category_id,
  template_fields = []
}: {
  site_id: string
  name: string
  description?: string
  icon?: string
  parent_category_id?: string | null
  template_fields?: any[]
}) {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('record_categories')
      .insert({
        site_id,
        name,
        description,
        icon,
        parent_category_id,
        template_fields
      })
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { category: data }
  } catch (error: any) {
    console.error("Error creating category:", error)
    return { error: error.message || "Failed to create category" }
  }
}

export async function updateRecordCategory(
  id: string,
  updates: Partial<RecordCategory>
) {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('record_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { category: data }
  } catch (error: any) {
    console.error("Error updating category:", error)
    return { error: error.message || "Failed to update category" }
  }
}

export async function deleteRecordCategory(id: string) {
  try {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('record_categories')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    revalidatePath("/records")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting category:", error)
    return { error: error.message || "Failed to delete category" }
  }
}


export async function resolveRelationsForSidebar(
  entitiesToResolve: { target: string; ids: string[] }[]
): Promise<Record<string, string>> {
  try {
    const supabase = await createServiceClient()
    const result: Record<string, string> = {}

    for (const { target, ids } of entitiesToResolve) {
      if (!ids.length) continue

      let table = target
      let nameField = "name"

      if (target === "lead") { table = "leads"; nameField = "name" }
      else if (target === "company") { table = "companies"; nameField = "name" }
      else if (target === "sales_order") { table = "orders"; nameField = "order_number" }
      else if (target === "deal") { table = "deals"; nameField = "title" }
      else if (target === "person") { table = "users"; nameField = "name" }
      else if (target === "campaign") { table = "campaigns"; nameField = "name" }
      else if (target === "catalog_item") { table = "products"; nameField = "name" }
      else if (target === "content") { table = "content"; nameField = "title" }
      else if (target === "task") { table = "tasks"; nameField = "title" }
      else if (target === "sale") { table = "sales"; nameField = "title" }
      else if (target === "purchase") { table = "purchases"; nameField = "title" }
      else if (target === "quotation") { table = "quotations"; nameField = "title" }
      else if (target === "record") { table = "records"; nameField = "title" }
      else if (target === "record_category") { table = "record_categories"; nameField = "name" }
      else if (target === "team_member") { table = "site_users"; nameField = "name" }

      const { data, error } = await supabase
        .from(table)
        .select(`id, ${nameField}`)
        .in(target === 'team_member' ? 'user_id' : 'id', ids)

      if (!error && data) {
        for (const item of data) {
          result[target === 'team_member' ? item.user_id : item.id] = item[nameField] || 'Unnamed'
        }
      }
    }

    return result
  } catch (error) {
    console.error("Error resolving relations for sidebar:", error)
    return {}
  }
}


export async function getRecords(siteId: string, categoryId?: string): Promise<{ records: RecordItem[] | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    let query = supabase
      .from("records")
      .select("*, category:record_categories(*)")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false })
      
    if (categoryId) {
      query = query.eq("category_id", categoryId)
    }

    const { data, error } = await query

    if (error) throw error
    return { records: data as RecordItem[], error: null }
  } catch (error: any) {
    console.error("Error in getRecords:", error)
    return { records: null, error: error.message || "Failed to fetch records" }
  }
}

export async function getRecordById(id: string): Promise<{ record: RecordItem | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from("records")
      .select("*, category:record_categories(*)")
      .eq("id", id)
      .single()

    if (error) throw error
    return { record: data as RecordItem, error: null }
  } catch (error: any) {
    console.error("Error in getRecordById:", error)
    return { record: null, error: error.message || "Failed to fetch record" }
  }
}

export async function createRecord({
  site_id,
  category_id,
  title,
  description,
  data = {},
  relations = {},
  status = 'draft'
}: {
  site_id: string
  category_id: string
  title: string
  description?: string
  data?: any
  relations?: any
  status?: string
}) {
  try {
    const supabase = await createServiceClient()
    const { data: record, error } = await supabase
      .from('records')
      .insert({
        site_id,
        category_id,
        title,
        description,
        data,
        relations,
        status
      })
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { record }
  } catch (error: any) {
    console.error("Error creating record:", error)
    return { error: error.message || "Failed to create record" }
  }
}

export async function updateRecord(
  id: string,
  updates: Partial<RecordItem>
) {
  try {
    const supabase = await createServiceClient()
    const { data: record, error } = await supabase
      .from('records')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { record }
  } catch (error: any) {
    console.error("Error updating record:", error)
    return { error: error.message || "Failed to update record" }
  }
}

export async function deleteRecord(id: string) {
  try {
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', id)
    
    if (error) throw error
    revalidatePath("/records")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting record:", error)
    return { error: error.message || "Failed to delete record" }
  }
}

export async function getVectorRelatedRecords(
  recordId: string,
  matchThreshold: number = 0.1, // Bajamos el umbral para ser más permisivos (antes 0.5)
  matchCount: number = 5
): Promise<{ records: any[] | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase.rpc('match_records_vector', {
      query_record_id: recordId,
      match_threshold: matchThreshold,
      match_count: matchCount
    })

    if (error) throw error
    return { records: data, error: null }
  } catch (error: any) {
    console.error("Error in getVectorRelatedRecords:", error)
    return { records: null, error: error.message || "Failed to fetch vector related records" }
  }
}

export async function getHistoricalRelatedRecords(

  categoryId: string,
  relationField: string,
  relationTargetId: string
): Promise<{ records: RecordItem[] | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("category_id", categoryId)
      .eq(`relations->>${relationField}`, relationTargetId)
      .order("created_at", { ascending: true })

    if (error) throw error
    return { records: data as RecordItem[], error: null }
  } catch (error: any) {
    console.error("Error in getHistoricalRelatedRecords:", error)
    return { records: null, error: error.message || "Failed to fetch historical records" }
  }
}


