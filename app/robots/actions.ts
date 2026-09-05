"use server"

import { createClient, createServiceClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"

export async function deleteInstanceArtifacts(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  if (!ids?.length) {
    return { success: true }
  }

  const { data: rows, error: fetchError } = await supabase
    .from("instance_artifacts")
    .select("id, user_id, site_id, instance_id")
    .in("id", ids)

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (!rows?.length) {
    return { success: true }
  }

  const siteIds = [...new Set(rows.map((row) => row.site_id).filter(Boolean))] as string[]
  for (const siteId of siteIds) {
    const canDismiss = await userCanOnSite(supabase, siteId, "update")
    const ownsRows = rows
      .filter((row) => row.site_id === siteId)
      .every((row) => row.user_id === user.id)
    if (!canDismiss && !ownsRows) {
      throw new Error("Permission denied")
    }
  }

  const { data: deleted, error } = await supabase
    .from("instance_artifacts")
    .delete()
    .in("id", ids)
    .select("id")

  if (error) {
    throw new Error(error.message)
  }

  const deletedIds = new Set((deleted ?? []).map((row) => row.id))
  const remaining = rows.map((row) => row.id).filter((id) => !deletedIds.has(id))

  if (remaining.length === 0) {
    return { success: true }
  }

  // RLS only lets owners / creators / instance owners delete. Site admins can
  // dismiss artifacts in the UI, so finish leftover rows with the service client
  // after the authorization check above.
  const service = await createServiceClient()
  const { error: serviceError } = await service
    .from("instance_artifacts")
    .delete()
    .in("id", remaining)

  if (serviceError) {
    throw new Error(serviceError.message)
  }

  return { success: true }
}
