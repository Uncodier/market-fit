'use server'

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getCurrentUserSiteRole, isSiteManagerRole } from "@/lib/auth/api-site-access"
import { userCanOnSite } from "@/lib/permissions/site-access"

const unconfirmed = "Deletion could not be confirmed. Refresh the requirements list before trying again."

export async function deleteRequirementRecord(id: string) {
  const input = z.string().uuid().safeParse(id)
  if (!input.success) return { error: "Invalid requirement ID." }
  const requirementId = input.data.toLowerCase()

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.is_anonymous) return { error: "Please sign in to delete this requirement." }

    const { data: requirement, error: readError } = await supabase.from("requirements")
      .select("id, site_id").eq("id", requirementId).maybeSingle()
    if (readError) return { error: "Unable to verify requirement access." }
    if (!requirement || requirement.id !== requirementId || !requirement.site_id) {
      return { error: "Requirement not found or access denied." }
    }

    const role = await getCurrentUserSiteRole(supabase, requirement.site_id)
    if (!isSiteManagerRole(role) || !await userCanOnSite(supabase, requirement.site_id, "delete")) {
      return { error: "Only project owners and admins with delete permission can delete requirements." }
    }

    // One statement: database cascades and guards commit or roll back together.
    // Never pre-delete associations or the private, immutable retirement audit.
    const { data: deleted, error } = await supabase.from("requirements")
      .delete().eq("id", requirementId).eq("site_id", requirement.site_id).select("id").maybeSingle()
    if (error) {
      if (error.code === "PT403" || error.code === "42501") {
        return { error: "You do not have permission to delete this requirement." }
      }
      if (error.code === "23503" || error.code === "23514") {
        return { error: "Related records prevent deletion. Contact your administrator." }
      }
      return { error: unconfirmed }
    }
    if (!deleted || deleted.id !== requirementId) return { error: unconfirmed }

    revalidatePath("/requirements")
    return { success: true }
  } catch {
    return { error: unconfirmed }
  }
}