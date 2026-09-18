"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { processRecordEmbeddingsById } from "./lib/record-embedding-worker"
import {
  resolveEntityPreviews as resolveEntityPreviewsAction,
  resolveRelationsForSidebar as resolveRelationsForSidebarAction,
} from "./entity-preview-actions"

const recordIdSchema = z.string().uuid()
const siteIdSchema = z.string().uuid()
const categoryIdSchema = z.string().uuid()
const updateRecordSchema = z.object({
  category_id: categoryIdSchema.optional(),
  title: z.string().trim().min(1).max(2000).optional(),
  description: z.string().nullable().optional(),
  data: z.record(z.unknown()).optional(),
  relations: z.record(z.unknown()).optional(),
  status: z.string().trim().min(1).max(100).optional(),
}).strict()
const categoryMutationSchema = z.object({
  name: z.string().trim().min(1).max(240),
  description: z.string().max(12_000).nullish(),
  icon: z.string().max(100).nullish(),
  parent_category_id: categoryIdSchema.nullish(),
  template_fields: z.array(z.unknown()).max(200).default([]),
}).strict()
const createRecordSchema = z.object({
  site_id: siteIdSchema,
  category_id: categoryIdSchema,
  title: z.string().trim().min(1).max(2000),
  description: z.string().max(100_000).optional(),
  data: z.record(z.unknown()).default({}),
  relations: z.record(z.unknown()).default({}),
  status: z.string().trim().min(1).max(100).default("draft"),
}).strict()

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Not authenticated")
  return supabase
}

function scheduleRecordEmbedding(recordId: string) {
  after(async () => {
    try {
      await processRecordEmbeddingsById({ recordId })
    } catch (error) {
      console.error("[records] deferred embedding failed", error)
    }
  })
}

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
    const parsedSiteId = siteIdSchema.parse(siteId)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from("record_categories")
      .select("*")
      .eq("site_id", parsedSiteId)
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
    const input = categoryMutationSchema.extend({ site_id: siteIdSchema }).parse({
      site_id,
      name,
      description,
      icon,
      parent_category_id,
      template_fields,
    })
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from('record_categories')
      .insert(input)
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
    const categoryId = categoryIdSchema.parse(id)
    const safeUpdates = categoryMutationSchema.partial().parse(updates)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from('record_categories')
      .update(safeUpdates)
      .eq('id', categoryId)
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
    const categoryId = categoryIdSchema.parse(id)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from('record_categories')
      .delete()
      .eq('id', categoryId)
      .select("id")
      .maybeSingle()
    
    if (error) throw error
    if (!data) throw new Error("Category not found or access denied")
    revalidatePath("/records")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting category:", error)
    return { error: error.message || "Failed to delete category" }
  }
}

export async function resolveRelationsForSidebar(
  entitiesToResolve: { target: string; ids: string[] }[]
) {
  return resolveRelationsForSidebarAction(entitiesToResolve)
}


export async function getRecords(siteId: string, categoryId?: string): Promise<{ records: RecordItem[] | null; error: string | null }> {
  try {
    const parsedSiteId = siteIdSchema.parse(siteId)
    const parsedCategoryId = categoryId ? categoryIdSchema.parse(categoryId) : undefined
    const supabase = await getAuthenticatedClient()
    let query = supabase
      .from("records")
      .select("*, category:record_categories!records_category_site_fkey(*)")
      .eq("site_id", parsedSiteId)
      .order("created_at", { ascending: false })
      
    if (parsedCategoryId) {
      query = query.eq("category_id", parsedCategoryId)
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
    const recordId = recordIdSchema.parse(id)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from("records")
      .select("*, category:record_categories!records_category_site_fkey(*)")
      .eq("id", recordId)
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
    const input = createRecordSchema.parse({
      site_id,
      category_id,
      title,
      description,
      data,
      relations,
      status,
    })
    const supabase = await getAuthenticatedClient()
    const { data: record, error } = await supabase
      .from('records')
      .insert(input)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    scheduleRecordEmbedding(record.id)
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
    const recordId = recordIdSchema.parse(id)
    const safeUpdates = updateRecordSchema.parse(updates)
    const supabase = await getAuthenticatedClient()
    const { data: record, error } = await supabase
      .from('records')
      .update(safeUpdates)
      .eq('id', recordId)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    scheduleRecordEmbedding(record.id)
    return { record }
  } catch (error: any) {
    console.error("Error updating record:", error)
    return { error: error.message || "Failed to update record" }
  }
}

export async function deleteRecord(id: string) {
  try {
    const recordId = recordIdSchema.parse(id)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase
      .from('records')
      .delete()
      .eq('id', recordId)
      .select('id')
      .maybeSingle()
    
    if (error) throw error
    if (!data) throw new Error("Record not found or access denied")
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
    const recordIdValue = recordIdSchema.parse(recordId)
    const supabase = await getAuthenticatedClient()
    const { data, error } = await supabase.rpc('match_records_vector', {
      query_record_id: recordIdValue,
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
    const supabase = await getAuthenticatedClient()
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

export type { EntityPreview } from "./entity-preview-actions"

export async function resolveEntityPreviews(
  entitiesToResolve: { target: string; ids: string[] }[]
) {
  return resolveEntityPreviewsAction(entitiesToResolve)
}

export async function getRecordsSimilarityEdges(
  siteId: string,
  matchThreshold: number = 0.5,
  matchPerRecord: number = 5
): Promise<{ edges: { source_id: string; target_id: string; similarity: number }[] | null; error: string | null }> {
  try {
    const supabase = await getAuthenticatedClient()
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


