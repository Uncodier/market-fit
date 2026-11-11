"use server"

import { createClient } from "@/lib/supabase/server"

import { z } from "zod"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"
import { getRelationTargetConfig } from "./lib/relation-target"
import { getSiteCompanyIds } from "./lib/relation-query"
import { entityPreviewKey, type EntityPreviewRequest } from "./lib/entity-preview-request"

const requestSchema = z.array(z.object({
  target: z.string().min(1).max(80),
  ids: z.array(z.string().uuid()).max(200),
  targetCategoryId: z.string().uuid().optional(),
}).strict().refine(value => !value.targetCategoryId || value.target === "record"))
  .max(50).refine(requests => requests.reduce((count, request) => count + request.ids.length, 0) <= 1000)

export type EntityPreview = {
  label: string
  summary: string
  fields: { label: string; value: string }[]
}

const ENTITY_PREVIEW_CONFIG: Record<string, {
  select: string
  fields: { col: string; label: string }[]
}> = {
  lead: { select: "id, name, email, company, status", fields: [
    { col: "company", label: "Company" },
    { col: "email", label: "Email" },
    { col: "status", label: "Status" },
  ]},
  supplier: { select: "id, name", fields: [] },
  company: { select: "id, name, industry", fields: [
    { col: "industry", label: "Industry" },
  ]},
  sales_order: { select: "id, order_number, total, status", fields: [
    { col: "total", label: "Total" },
    { col: "status", label: "Status" },
  ]},
  deal: { select: "id, name, amount, stage", fields: [
    { col: "amount", label: "Amount" },
    { col: "stage", label: "Stage" },
  ]},
  team_member: { select: "user_id, name, email, role, status", fields: [
    { col: "email", label: "Email" },
    { col: "role", label: "Role" },
    { col: "status", label: "Status" },
  ]},
  campaign: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  catalog_item: { select: "id, name, kind, status, target_sale_price", fields: [
    { col: "kind", label: "Type" },
    { col: "status", label: "Status" },
    { col: "target_sale_price", label: "Price" },
  ]},
  content: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  task: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  sale: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  purchase: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  quotation: { select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  record: { select: "id, title, description, status", fields: [
    { col: "status", label: "Status" },
    { col: "description", label: "Summary" },
  ]},
  record_category: { select: "id, name, description", fields: [
    { col: "description", label: "Description" },
  ]},
}

async function resolvePreviews(
  entitiesToResolve: EntityPreviewRequest[],
  siteId: string,
  labelsOnly: boolean,
): Promise<Record<string, EntityPreview>> {
  const site = z.string().uuid().safeParse(siteId)
  const parsed = requestSchema.safeParse(entitiesToResolve)
  if (!site.success || !parsed.success) return {}
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user || !await userCanOnSite(supabase, site.data, "select") ||
        !await canAccessUnscopedSite(supabase, site.data)) return {}

    const result: Record<string, EntityPreview> = {}
    // Bare UUID compatibility is safe only when the request identifies one scope.
    const scopes = new Map<string, Set<string>>()
    for (const request of parsed.data) {
      for (const id of request.ids) {
        const keys = scopes.get(id) || new Set<string>()
        keys.add(entityPreviewKey(request, id))
        scopes.set(id, keys)
      }
    }
    for (const request of parsed.data) {
      const { target, targetCategoryId } = request
      const config = getRelationTargetConfig(target)
      if (!config || request.ids.length === 0) continue
      const preview = ENTITY_PREVIEW_CONFIG[target]
      let ids = [...new Set(request.ids)]
      if (target === "company") ids = await getSiteCompanyIds(supabase, site.data, ids)
      if (!ids.length) continue
      if (targetCategoryId) {
        const category = await supabase.from("record_categories").select("id")
          .eq("site_id", site.data).eq("id", targetCategoryId).is("deleted_at", null).maybeSingle()
        if (category.error || !category.data) continue
      }
      let query = supabase.from(config.table)
        .select(labelsOnly || !preview ? `${config.idField}, ${config.nameField}` : preview.select)
        .in(config.idField, ids)
      if (target !== "company") query = query.eq("site_id", site.data)
      if (target === "record" || target === "record_category") query = query.is("deleted_at", null)
      if (targetCategoryId) query = query.eq("category_id", targetCategoryId)
      if (target === "team_member") {
        query = query.eq("status", "active")
          .or("license_suspended.is.null,license_suspended.eq.false")
          .or("manually_disabled.is.null,manually_disabled.eq.false")
      }
      const { data, error: queryError } = await query.limit(200)
      if (queryError || !data) continue
      for (const item of data as unknown as Record<string, unknown>[]) {
        const id = item[config.idField]
        if (typeof id !== "string" || !ids.includes(id)) continue
        const label = formatPreviewValue(item[config.nameField]) || "Unnamed"
        const fields = (labelsOnly ? [] : preview?.fields || [])
          .map(field => ({ label: field.label, value: formatPreviewValue(item[field.col]) }))
          .filter(field => field.value)
        const value = { label, fields, summary: fields.map(field => `${field.label}: ${field.value}`).join(" · ") || label }
        result[entityPreviewKey(request, id)] = value
        if (scopes.get(id)?.size === 1) result[id] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

export async function resolveRelationsForSidebar(
  entitiesToResolve: EntityPreviewRequest[],
  siteId: string,
): Promise<Record<string, string>> {
  const previews = await resolvePreviews(entitiesToResolve, siteId, true)
  return Object.fromEntries(Object.entries(previews).map(([key, preview]) => [key, preview.label]))
}

export async function resolveEntityPreviews(
  entitiesToResolve: EntityPreviewRequest[],
  siteId: string,
): Promise<Record<string, EntityPreview>> {
  return resolvePreviews(entitiesToResolve, siteId, false)
}

function formatPreviewValue(value: unknown): string {
  if (value == null || value === "") return ""
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toLocaleString()
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    const nested = object.name ?? object.title ?? object.email ?? object.company ?? object.label
    return nested && nested !== value ? formatPreviewValue(nested) : ""
  }
  const text = String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  if (!text || text === "[object Object]") return ""
  return text.length > 80 ? `${text.slice(0, 80).trim()}…` : text
}
