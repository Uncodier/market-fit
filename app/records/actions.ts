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
  matchThreshold: number = 0.1,
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

export type EntityPreview = {
  label: string
  summary: string
  fields: { label: string; value: string }[]
}

const ENTITY_PREVIEW_CONFIG: Record<string, {
  table: string
  idField: string
  labelField: string
  select: string
  fields: { col: string; label: string }[]
}> = {
  lead: { table: "leads", idField: "id", labelField: "name", select: "id, name, email, company, status", fields: [
    { col: "company", label: "Company" },
    { col: "email", label: "Email" },
    { col: "status", label: "Status" },
  ]},
  company: { table: "companies", idField: "id", labelField: "name", select: "id, name, industry", fields: [
    { col: "industry", label: "Industry" },
  ]},
  sales_order: { table: "orders", idField: "id", labelField: "order_number", select: "id, order_number, total, status", fields: [
    { col: "total", label: "Total" },
    { col: "status", label: "Status" },
  ]},
  deal: { table: "deals", idField: "id", labelField: "title", select: "id, title, value, stage", fields: [
    { col: "value", label: "Value" },
    { col: "stage", label: "Stage" },
  ]},
  person: { table: "users", idField: "id", labelField: "name", select: "id, name, email", fields: [
    { col: "email", label: "Email" },
  ]},
  team_member: { table: "site_users", idField: "user_id", labelField: "name", select: "user_id, name", fields: []},
  campaign: { table: "campaigns", idField: "id", labelField: "name", select: "id, name, status", fields: [
    { col: "status", label: "Status" },
  ]},
  catalog_item: { table: "products", idField: "id", labelField: "name", select: "id, name, price", fields: [
    { col: "price", label: "Price" },
  ]},
  content: { table: "content", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  task: { table: "tasks", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  sale: { table: "sales", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  purchase: { table: "purchases", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  quotation: { table: "quotations", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  record: { table: "records", idField: "id", labelField: "title", select: "id, title, description, status", fields: [
    { col: "status", label: "Status" },
    { col: "description", label: "Summary" },
  ]},
  record_category: { table: "record_categories", idField: "id", labelField: "name", select: "id, name, description", fields: [
    { col: "description", label: "Description" },
  ]},
}

function formatPreviewValue(value: unknown): string {
  if (value == null || value === "") return ""
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString()
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const nested = obj.name ?? obj.title ?? obj.email ?? obj.company ?? obj.label
    if (nested && nested !== value) return formatPreviewValue(nested)
    return ""
  }
  const text = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!text || text === "[object Object]") return ""
  return text.length > 80 ? `${text.slice(0, 80).trim()}…` : text
}

export async function resolveEntityPreviews(
  entitiesToResolve: { target: string; ids: string[] }[]
): Promise<Record<string, EntityPreview>> {
  try {
    const supabase = await createServiceClient()
    const result: Record<string, EntityPreview> = {}

    for (const { target, ids } of entitiesToResolve) {
      if (!ids.length) continue
      const config = ENTITY_PREVIEW_CONFIG[target]
      if (!config) continue

      const { data, error } = await supabase
        .from(config.table)
        .select(config.select)
        .in(config.idField, ids)

      if (error || !data) {
        console.error(`Error resolving ${target} previews:`, error)
        continue
      }

      for (const item of data as any[]) {
        const id = item[config.idField]
        const label = formatPreviewValue(item[config.labelField]) || "Unnamed"
        const fields = config.fields
          .map((field) => ({
            label: field.label,
            value: formatPreviewValue(item[field.col]),
          }))
          .filter((field) => field.value)

        result[id] = {
          label,
          summary: fields.map((field) => `${field.label}: ${field.value}`).join(" · ") || label,
          fields,
        }
      }
    }

    return result
  } catch (error) {
    console.error("Error in resolveEntityPreviews:", error)
    return {}
  }
}

export async function getRecordsSimilarityEdges(
  siteId: string,
  matchThreshold: number = 0.5,
  matchPerRecord: number = 5
): Promise<{ edges: { source_id: string; target_id: string; similarity: number }[] | null; error: string | null }> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase.rpc('get_records_similarity_edges', {
      p_site_id: siteId,
      match_threshold: matchThreshold,
      match_per_record: matchPerRecord
    })

    if (error) throw error
    return { edges: data, error: null }
  } catch (error: any) {
    console.error("Error in getRecordsSimilarityEdges:", error)
    return { edges: null, error: error.message || "Failed to fetch similarity edges" }
  }
}


