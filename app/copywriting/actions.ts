"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { isScreenBlocked } from "@/lib/auth/screen-access"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"
import { readWorkspaceScreenScope } from "@/lib/permissions/workspace-screen-scope"
import { createClient } from "@/lib/supabase/server"
import { copyFieldsSchema, type CopyFields, type CopywritingItem } from "./copywriting-model"

const projection = "id, title, content, copy_type, status, target_audience, use_case, notes"
const uuid = z.string().uuid()

async function authorize(siteId: string) {
  uuid.parse(siteId)
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error("Copywriting access denied")

  const scope = await readWorkspaceScreenScope(supabase, user.id, siteId, AbortSignal.timeout(8000))
  if ((scope.status !== "ready" && scope.status !== "legacy") ||
      isScreenBlocked(scope.role, scope.blockedScreens, "copywriting")) {
    throw new Error("Copywriting access denied")
  }
  const role = scope.status === "legacy" ? await lookupCurrentUserSiteRole(supabase, siteId) : scope.role
  if (!role) throw new Error("Copywriting access denied")
  return { supabase, actorId: user.id, canWrite: role === "owner" || role === "admin" || role === "collaborator" }
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