import type { SupabaseClient } from "@supabase/supabase-js"
import { getRelationTargetConfig } from "./relation-target"
import {
  isRecordObject, recordUuid, validateScalarValue, validateTemplateFields,
  type Validation, type ValidatedTemplateField,
} from "./template-validation"

export type RecordWriteValues = {
  site_id: string
  category_id: string
  data: unknown
  relations: unknown
  status: string
}

async function readableTarget(supabase: SupabaseClient, siteId: string, field: ValidatedTemplateField, id: string): Promise<boolean> {
  const target = field.relationTarget ?? "lead"
  const config = getRelationTargetConfig(target)
  if (!config) return false
  if (target === "company") {
    const company = await supabase.from("companies").select("id").eq("id", id).maybeSingle()
    if (company.error || !company.data) return false
    const links = await Promise.all(["leads", "deals", "suppliers"].map(table =>
      supabase.from(table).select("id").eq("site_id", siteId).eq("company_id", id).limit(1)))
    return links.some(link => !link.error && link.data && link.data.length > 0)
  }
  let query = supabase.from(config.table).select(config.idField).eq("site_id", siteId).eq(config.idField, id)
  if (target === "record" || target === "record_category") query = query.is("deleted_at", null)
  if (target === "record" && field.targetCategoryId) query = query.eq("category_id", field.targetCategoryId)
  if (target === "team_member") {
    query = query.eq("status", "active")
      .or("license_suspended.is.null,license_suspended.eq.false")
      .or("manually_disabled.is.null,manually_disabled.eq.false")
  }
  const result = await query.maybeSingle()
  return !result.error && !!result.data
}

/** Call with a user-scoped client after authentication and source authorization.
 * Previous values must come from the database, never the request. This is admission
 * validation, not a substitute for RLS or database concurrency/integrity guards.
 */
export async function validateRecordWrite(
  supabase: SupabaseClient,
  input: RecordWriteValues,
  previous?: RecordWriteValues,
): Promise<Validation> {
  const fail = (error: string): Validation => ({ valid: false, error })
  if (!recordUuid.test(input.site_id) || !recordUuid.test(input.category_id)) return fail("Invalid site or category")
  // Nullable legacy columns represent empty objects; do not rewrite the input.
  const data = input.data === null ? {} : input.data
  const relations = input.relations === null ? {} : input.relations
  if (!isRecordObject(data) || !isRecordObject(relations)) return fail("Record data and relations must be objects")
  if (typeof input.status !== "string" || !input.status.trim()) return fail("Invalid record status")
  try {
    const category = await supabase.from("record_categories").select("id, template_fields, system_key")
      .eq("site_id", input.site_id).eq("id", input.category_id).is("deleted_at", null).maybeSingle()
    if (category.error || !category.data) return fail("Category not found or access denied")
    const template = validateTemplateFields(category.data.template_fields ?? [])
    if (!template.valid) return template
    const relationFields = new Map(template.fields.filter(field => field.type === "relation").map(field => [field.name, field]))
    const oldRelations = previous && previous.site_id === input.site_id && previous.category_id === input.category_id
      && isRecordObject(previous.relations) ? previous.relations : {}
    for (const [key, value] of Object.entries(relations)) {
      if (value === null || value === "") continue
      if (!relationFields.has(key)) {
        // Preserve historical opaque links only when unchanged; never reinterpret them.
        if (typeof value !== "string" || !Object.hasOwn(oldRelations, key) || oldRelations[key] !== value) return fail(`Unknown relation field: ${key}`)
      }
    }
    const dataFields = new Set(template.fields.filter(field => field.type !== "relation").map(field => field.name))
    const oldData = previous && previous.site_id === input.site_id && previous.category_id === input.category_id
      && isRecordObject(previous.data) ? previous.data : {}
    const feedbackMetadata = new Set(["agent_id", "instance_id", "conversation_id", "command_id", "message_id", "feedback_by"])
    for (const [key, value] of Object.entries(data)) {
      if (dataFields.has(key)) continue
      if (category.data.system_key === "ai-feedback" && feedbackMetadata.has(key)) continue
      if (!Object.hasOwn(oldData, key) || JSON.stringify(oldData[key]) !== JSON.stringify(value)) return fail(`Unknown data field: ${key}`)
    }
    // Preserve unchanged legacy data and the known ai-feedback metadata contract.
    // Drafts can be saved incrementally; only non-drafts require complete fields.
    for (const field of template.fields) {
      const values = field.type === "relation" ? relations : data
      const value = Object.hasOwn(values, field.name) ? values[field.name] : undefined
      const scalar = validateScalarValue(field, value, input.status !== "draft")
      if (!scalar.valid) return scalar
      if (field.type !== "relation" || value === undefined || value === null || value === "") continue
      // Preserve a historical reference without reassigning it or exposing its target.
      // The source is still subject to its own current authorization and version check.
      if (Object.hasOwn(oldRelations, field.name) && oldRelations[field.name] === value) continue
      if ((field.relationTarget ?? "lead") === "person") {
        if (oldRelations[field.name] !== value) return fail(`${field.label || field.name}: person links are unsupported`)
        continue
      }
      if (!await readableTarget(supabase, input.site_id, field, value as string)) {
        return fail(`${field.label || field.name}: target not found or access denied`)
      }
    }
    return { valid: true }
  } catch {
    return fail("Unable to validate record targets")
  }
}