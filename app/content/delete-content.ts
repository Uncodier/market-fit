import "server-only"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { authorizeOutstandSite } from "./outstand-access"
import { accountIdSchema, outstandFailure, siteIdSchema, UNCONFIRMED_DELETE } from "./outstand-contract"
import { requestOutstandContentDeletion } from "./outstand-http"
import { parseOutstandDeleted } from "./outstand-response"
import { getLinkedOutstandPostIds, type DeleteContentOptions, type DeleteContentResult } from "./delete-content-types"

const inputSchema = z.object({
  contentId: siteIdSchema,
  options: z.object({ deleteFromOutstand: z.boolean().optional() }).strict(),
})
const contentSchema = z.object({
  id: siteIdSchema,
  site_id: siteIdSchema,
  tags: z.array(z.string()).nullable(),
  updated_at: z.string().min(1),
})

export async function deleteContentRecord(
  contentId: string, options: DeleteContentOptions = {},
): Promise<DeleteContentResult> {
  const input = inputSchema.safeParse({ contentId, options })
  if (!input.success) return { success: false, status: 400, error: "Invalid content deletion request." }

  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) return { success: false, status: 401, error: "Sign in to delete content." }

    const { data, error } = await supabase.from("content")
      .select("id, site_id, tags, updated_at").eq("id", input.data.contentId).maybeSingle()
    if (error) return { success: false, status: 503, error: "Unable to load content for deletion." }
    if (!data) return { success: false, status: 404, error: "Content not found or access denied." }
    const parsed = contentSchema.safeParse(data)
    if (!parsed.success || parsed.data.id !== input.data.contentId) {
      return { success: false, status: 502, error: "Unable to verify content for deletion." }
    }
    const content = parsed.data
    if (!await userCanOnSite(supabase, content.site_id, "delete")) {
      return { success: false, status: 403, error: "You do not have permission to delete this content." }
    }

    if (input.data.options.deleteFromOutstand) {
      const postIds = getLinkedOutstandPostIds(content.tags)
      if (!postIds.length || postIds.length > 100 || postIds.some(id => !accountIdSchema.safeParse(id).success)) {
        return { success: false, status: 400, error: "No valid linked Outstand posts could be verified. Content was not deleted." }
      }
      try {
        const access = await authorizeOutstandSite(content.site_id, "delete")
        // The API independently verifies provider account ownership. Stored tags
        // identify candidates; they are never proof of ownership by themselves.
        for (const postId of postIds) {
          const result = await requestOutstandContentDeletion(access.siteId, access.token, postId)
          parseOutstandDeleted(result, access.siteId, postId)
        }
      } catch (failure) {
        const result = outstandFailure(failure, UNCONFIRMED_DELETE)
        return { ...result, error: `${result.error} Local content was not deleted.` }
      }
    }

    // Preserve edits made while provider deletion was in flight. RLS and the
    // delete capability still apply; never fall back to a service-role client.
    const deleted = await supabase.from("content").delete()
      .eq("id", content.id).eq("site_id", content.site_id).eq("updated_at", content.updated_at)
      .select("id").maybeSingle()
    if (deleted.error || deleted.data?.id !== content.id) {
      return { success: false, status: 409, error: options.deleteFromOutstand
        ? "Social posts were deleted, but local deletion could not be confirmed. Refresh and delete only the local content."
        : "Content deletion could not be confirmed. Refresh the content before retrying." }
    }
    revalidatePath("/content")
    return { success: true }
  } catch {
    return { success: false, status: 500, error: "Content deletion could not be confirmed. Refresh before retrying." }
  }
}