"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isScreenBlocked } from "@/lib/auth/screen-access"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"
import { readWorkspaceScreenScope } from "@/lib/permissions/workspace-screen-scope"
import { createClient } from "@/lib/supabase/server"
import { copyFieldsSchema, type CopyFields, type CopywritingItem } from "./copywriting-model"
import { copyTemplateSchema, WHATSAPP_TEMPLATE_TAG, type CopyTemplateDraft } from "./template-model"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { canAccessUnscopedSite } from "@/lib/permissions/location-boundary"

const projection = "id, title, content, copy_type, status, target_audience, use_case, notes, tags"
const uuid = z.string().uuid()

async function authorize(siteId: string) {
  uuid.parse(siteId)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.is_anonymous) throw new Error("Copywriting access denied")

  const scope = await readWorkspaceScreenScope(supabase, user.id, siteId, AbortSignal.timeout(8000))
  if ((scope.status !== "ready" && scope.status !== "legacy") ||
      isScreenBlocked(scope.role, scope.blockedScreens, "copywriting")) {
    throw new Error("Copywriting access denied")
  }
  const role = scope.status === "legacy" ? await lookupCurrentUserSiteRole(supabase, siteId) : scope.role
  if (!role) throw new Error("Copywriting access denied")
  return { supabase, actorId: user.id, role, scope, canWrite: role === "owner" || role === "admin" || role === "collaborator" }
}

export async function getCopywriting(siteId: string): Promise<{ items: CopywritingItem[]; canWrite: boolean }> {
  const { supabase, canWrite } = await authorize(siteId)
  const { data, error } = await supabase.from("copywriting").select(projection)
    .eq("site_id", siteId).order("created_at", { ascending: false }).order("id")
  if (error) throw new Error("Failed to load copywriting")
  return { items: data ?? [], canWrite }
}

export async function saveCopywriting(siteId: string, id: string | null, input: CopyFields): Promise<CopywritingItem> {
  if (id !== null) uuid.parse(id)
  const fields = copyFieldsSchema.parse(input)
  const { supabase, actorId, canWrite } = await authorize(siteId)
  if (!canWrite) throw new Error("Copywriting write denied")

  const values = {
    ...fields,
    target_audience: fields.target_audience || null,
    use_case: fields.use_case || null,
    notes: fields.notes || null,
  }
  const table = supabase.from("copywriting")
  const query = id === null
    ? table.insert({ ...values, site_id: siteId, user_id: actorId })
    : table.update({ ...values, updated_at: new Date().toISOString() }).eq("site_id", siteId).eq("id", id)
  const { data, error } = await query.select(projection).single()
  if (error || !data) throw new Error("Failed to save copywriting")

  revalidatePath("/copywriting")
  return data
}

export async function createCopyTemplate(siteId: string, copyId: string, input: CopyTemplateDraft): Promise<{ id: string; item?: CopywritingItem }> {
  uuid.parse(copyId)
  const draft = copyTemplateSchema.parse(input)
  const { supabase, actorId, scope, role, canWrite } = await authorize(siteId)
  if (!canWrite || (draft.kind === "newsletter" && isScreenBlocked(role, scope.blockedScreens, "content")) ||
      !await canAccessUnscopedSite(supabase, siteId) || !await userCanOnSite(supabase, siteId, "insert")) {
    throw new Error("Template creation denied")
  }
  const { data: source, error: sourceError } = await supabase.from("copywriting").select("id, target_audience, use_case, notes, tags")
    .eq("site_id", siteId).eq("id", copyId).maybeSingle()
  if (sourceError || !source) throw new Error("Source copy unavailable")

  if (draft.kind === "newsletter") {
    const { data, error } = await supabase.from("content").insert({
      site_id: siteId, user_id: actorId, author_id: actorId, title: draft.title, text: draft.body,
      type: "newsletter", status: "draft", metadata: { source_copywriting_id: source.id },
    }).select("id").single()
    if (error || !data) throw new Error("Failed to create newsletter draft")
    revalidatePath("/content")
    return { id: data.id }
  }

  const { data, error } = await supabase.from("copywriting").insert({
    site_id: siteId, user_id: actorId, title: draft.title, content: draft.body, copy_type: "other", status: "draft",
    target_audience: source.target_audience, use_case: source.use_case, notes: source.notes,
    tags: [...new Set([...(source.tags ?? []), WHATSAPP_TEMPLATE_TAG])],
  }).select(projection).single()
  if (error || !data) throw new Error("Failed to create WhatsApp draft")
  revalidatePath("/copywriting")
  return { id: data.id, item: data }
}

export async function findCopyTestRecipients(siteId: string, term: string, kind: CopyTemplateDraft["kind"]) {
  const search = z.string().trim().min(2).max(100).parse(term)
  const channel = z.enum(["newsletter", "whatsapp"]).parse(kind)
  const { supabase, canWrite, role, scope } = await authorize(siteId)
  if (!canWrite || isScreenBlocked(role, scope.blockedScreens, "leads") || isScreenBlocked(role, scope.blockedScreens, "chat") ||
      !await canAccessUnscopedSite(supabase, siteId)) throw new Error("Recipient search denied")
  const field = /^[^\s@]+@[^\s@]+$/.test(search) ? "email" : /^\+\d+$/.test(search) ? "phone" : "name"
  // Exact destinations or a bounded literal prefix search; do not expose the entire CRM.
  const list = supabase.from("leads").select("id, name, email, phone").eq("site_id", siteId)
    .not(channel === "newsletter" ? "email" : "phone", "is", null).order("name").limit(15)
  const { data, error } = await (field === "name" ? list.ilike(field, `${search.replace(/[\\%_*]/g, "\\$&")}%`) : list.eq(field, search))
  if (error) throw new Error("Recipient search unavailable")
  const rows: { id: string; name: string | null; email: string | null; phone: string | null }[] = data ?? []
  return rows.flatMap(lead => {
    const address = channel === "newsletter" ? lead.email : lead.phone
    if (typeof address !== "string" || !(channel === "newsletter" ? z.string().email().safeParse(address).success && address !== "no-email@example.com" : /^\+[1-9]\d{6,14}$/.test(address))) return []
    return [{ id: lead.id, label: `${lead.name || address}${lead.name ? ` · ${address}` : ""}` }]
  })
}