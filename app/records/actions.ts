"use server"

import { z } from "zod"
import { getRecordActionError } from "./lib/action-error"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { processRecordEmbeddingsById } from "./lib/record-embedding-worker"
import { validateTemplateFieldUpdate } from "./lib/template-validation"
import { validateRecordWrite } from "./lib/validate-record-write"
import { validateTemplateTargets } from "./lib/validate-template-targets"
import { moveRecordToTrash, moveCategoryToTrash } from "./trash-actions"
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
  description: z.string().max(100_000).nullable().optional(),
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
  } catch (error: unknown) {
    console.error("Error in getRecordCategories:", error)
    return { categories: null, error: getRecordActionError(error, "Failed to fetch categories") }
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
    const template = validateTemplateFieldUpdate([], input.template_fields, false)
    if (!template.valid) throw new Error(template.error)
    await validateTemplateTargets(supabase, input.site_id, template.fields)
    const { data, error } = await supabase
      .from('record_categories')
      .insert(input)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { category: data }
  } catch (error: unknown) {
    console.error("Error creating category:", error)
    return { error: getRecordActionError(error, "Failed to create category") }
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
    if (safeUpdates.template_fields !== undefined) {
      const previous = await supabase.from('record_categories').select('site_id, template_fields').eq('id', categoryId).maybeSingle()
      if (previous.error || !previous.data) throw new Error("Category not found or access denied")
      const records = await supabase.from('records').select('id', { count: 'exact', head: true }).eq('category_id', categoryId)
      if (records.error) throw new Error("Unable to verify category contents")
      const template = validateTemplateFieldUpdate(previous.data.template_fields, safeUpdates.template_fields, (records.count || 0) > 0)
      if (!template.valid) throw new Error(template.error)
      await validateTemplateTargets(supabase, previous.data.site_id, template.fields)
    }
    const { data, error } = await supabase
      .from('record_categories')
      .update(safeUpdates)
      .eq('id', categoryId)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    return { category: data }
  } catch (error: unknown) {
    console.error("Error updating category:", error)
    return { error: getRecordActionError(error, "Failed to update category") }
  }
}

export async function deleteRecordCategory(id: string) {
  return moveCategoryToTrash(id)
}

export async function getRecordTrash(siteId: string) {
  return (await import("./trash-actions")).getRecordTrash(siteId)
}

export async function restoreRecordCategory(id: string) {
  return (await import("./trash-actions")).restoreRecordCategory(id)
}

export async function restoreRecord(id: string) {
  return (await import("./trash-actions")).restoreRecord(id)
}

export type { TrashItem } from "./trash-actions"

export async function resolveRelationsForSidebar(
  entitiesToResolve: { target: string; ids: string[]; targetCategoryId?: string }[],
  siteId: string,
) {
  return resolveRelationsForSidebarAction(entitiesToResolve, siteId)
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
  } catch (error: unknown) {
    console.error("Error in getRecords:", error)
    return { records: null, error: getRecordActionError(error, "Failed to fetch records") }
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
  } catch (error: unknown) {
    console.error("Error in getRecordById:", error)
    return { record: null, error: getRecordActionError(error, "Failed to fetch record") }
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
    const validation = await validateRecordWrite(supabase, input)
    if (!validation.valid) throw new Error(validation.error)
    const { data: record, error } = await supabase
      .from('records')
      .insert(input)
      .select()
      .single()
    
    if (error) throw error
    revalidatePath("/records")
    scheduleRecordEmbedding(record.id)
    return { record }
  } catch (error: unknown) {
    console.error("Error creating record:", error)
    return { error: getRecordActionError(error, "Failed to create record") }
  }
}

export async function updateRecord(
  id: string,
  updates: Partial<RecordItem>,
  expectedUpdatedAt: string,
) {
  try {
    const recordId = recordIdSchema.parse(id)
    const safeUpdates = updateRecordSchema.parse(updates)
    const expectedVersion = z.string().datetime({ offset: true }).parse(expectedUpdatedAt)
    const supabase = await getAuthenticatedClient()
    const previous = await supabase.from('records')
      .select('site_id, category_id, data, relations, status, updated_at').eq('id', recordId).maybeSingle()
    if (previous.error || !previous.data) throw new Error("Record not found or access denied")
    if (previous.data.updated_at !== expectedVersion) {
      return { error: "This record changed elsewhere. Reload before saving again.", conflict: true }
    }
    const persisted = { ...previous.data, data: previous.data.data ?? {}, relations: previous.data.relations ?? {} }
    const validation = await validateRecordWrite(supabase, { ...persisted, ...safeUpdates }, persisted)
    if (!validation.valid) throw new Error(validation.error)
    const { data: record, error } = await supabase
      .from('records')
      .update(safeUpdates)
      .eq('id', recordId)
      .eq('updated_at', expectedVersion)
      .select()
      .maybeSingle()
    
    if (error) throw error
    if (!record) return { error: "This record changed elsewhere. Reload before saving again.", conflict: true }
    revalidatePath("/records")
    scheduleRecordEmbedding(record.id)
    return { record }
  } catch (error: unknown) {
    console.error("Error updating record:", error)
    return { error: getRecordActionError(error, "Failed to update record") }
  }
}

export async function deleteRecord(id: string) {
  return moveRecordToTrash(id)
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
  } catch (error: unknown) {
    console.error("Error in getVectorRelatedRecords:", error)
    return { records: null, error: getRecordActionError(error, "Failed to fetch vector related records") }
  }
}

export async function getHistoricalRelatedRecords(

  categoryId: string,
  relationField: string,
  relationTargetId: string
): Promise<{ records: RecordItem[] | null; error: string | null }> {
  try {
    const parsedCategoryId = categoryIdSchema.parse(categoryId)
    const parsedTargetId = recordIdSchema.parse(relationTargetId)
    const supabase = await getAuthenticatedClient()
    const category = await supabase.from("record_categories").select("site_id, template_fields")
      .eq("id", parsedCategoryId).maybeSingle()
    if (category.error || !category.data) throw new Error("Category not found or access denied")
    if (!Array.isArray(category.data.template_fields) || !category.data.template_fields.some(
      (field: { name?: string; type?: string }) => field.name === relationField && field.type === "relation",
    )) throw new Error("Unknown relation field")
    const { data, error } = await supabase
      .from("records")
      .select("*")
      .eq("site_id", category.data.site_id)
      .eq("category_id", parsedCategoryId)
      .contains("relations", { [relationField]: parsedTargetId })
      .order("created_at", { ascending: true })

    if (error) throw error
    return { records: data as RecordItem[], error: null }
  } catch (error: unknown) {
    console.error("Error in getHistoricalRelatedRecords:", error)
    return { records: null, error: getRecordActionError(error, "Failed to fetch historical records") }
  }
}

export type { EntityPreview } from "./entity-preview-actions"

export async function resolveEntityPreviews(
  entitiesToResolve: { target: string; ids: string[]; targetCategoryId?: string }[],
  siteId: string,
) {
  return resolveEntityPreviewsAction(entitiesToResolve, siteId)
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
  } catch (error: unknown) {
    console.error("Error in getRecordsSimilarityEdges:", error)
    return { edges: null, error: getRecordActionError(error, "Failed to fetch similarity edges") }
  }
}


