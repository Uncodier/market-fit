"use server"

import { createClient } from "@/lib/supabase/server"

type RelationResolutionConfig = {
  table: string
  idField: string
  nameField: string
}

const RELATION_RESOLUTION_CONFIG: Record<string, RelationResolutionConfig> = {
  lead: { table: "leads", idField: "id", nameField: "name" },
  company: { table: "companies", idField: "id", nameField: "name" },
  sales_order: { table: "orders", idField: "id", nameField: "order_number" },
  deal: { table: "deals", idField: "id", nameField: "name" },
  person: { table: "users", idField: "id", nameField: "name" },
  campaign: { table: "campaigns", idField: "id", nameField: "title" },
  catalog_item: { table: "catalog_items", idField: "id", nameField: "name" },
  content: { table: "content", idField: "id", nameField: "title" },
  task: { table: "tasks", idField: "id", nameField: "title" },
  sale: { table: "sales", idField: "id", nameField: "title" },
  purchase: { table: "purchases", idField: "id", nameField: "title" },
  quotation: { table: "quotations", idField: "id", nameField: "title" },
  record: { table: "records", idField: "id", nameField: "title" },
  record_category: { table: "record_categories", idField: "id", nameField: "name" },
  team_member: { table: "site_members", idField: "user_id", nameField: "name" },
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
  deal: { table: "deals", idField: "id", labelField: "name", select: "id, name, amount, stage", fields: [
    { col: "amount", label: "Amount" },
    { col: "stage", label: "Stage" },
  ]},
  person: { table: "users", idField: "id", labelField: "name", select: "id, name, email", fields: [
    { col: "email", label: "Email" },
  ]},
  team_member: { table: "site_members", idField: "user_id", labelField: "name", select: "user_id, name, email, role, status", fields: [
    { col: "email", label: "Email" },
    { col: "role", label: "Role" },
    { col: "status", label: "Status" },
  ]},
  campaign: { table: "campaigns", idField: "id", labelField: "title", select: "id, title, status", fields: [
    { col: "status", label: "Status" },
  ]},
  catalog_item: { table: "catalog_items", idField: "id", labelField: "name", select: "id, name, kind, status, target_sale_price", fields: [
    { col: "kind", label: "Type" },
    { col: "status", label: "Status" },
    { col: "target_sale_price", label: "Price" },
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

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Not authenticated")
  return supabase
}

export async function resolveRelationsForSidebar(
  entitiesToResolve: { target: string; ids: string[] }[]
): Promise<Record<string, string>> {
  try {
    const supabase = await getAuthenticatedClient()
    const result: Record<string, string> = {}

    for (const { target, ids } of entitiesToResolve) {
      const config = RELATION_RESOLUTION_CONFIG[target]
      if (!config || ids.length === 0) continue
      const { data, error } = await supabase
        .from(config.table)
        .select(`${config.idField}, ${config.nameField}`)
        .in(config.idField, ids.slice(0, 200))
      if (error || !data) continue

      for (const item of data) {
        result[item[config.idField]] = item[config.nameField] || "Unnamed"
      }
    }
    return result
  } catch (error) {
    console.error("Error resolving relations for sidebar:", error)
    return {}
  }
}

export async function resolveEntityPreviews(
  entitiesToResolve: { target: string; ids: string[] }[]
): Promise<Record<string, EntityPreview>> {
  try {
    const supabase = await getAuthenticatedClient()
    const result: Record<string, EntityPreview> = {}

    for (const { target, ids } of entitiesToResolve) {
      const config = ENTITY_PREVIEW_CONFIG[target]
      if (!config || ids.length === 0) continue
      const { data, error } = await supabase
        .from(config.table)
        .select(config.select)
        .in(config.idField, ids.slice(0, 200))
      if (error || !data) continue

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
    console.error("Error resolving entity previews:", error)
    return {}
  }
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
