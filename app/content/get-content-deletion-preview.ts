"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { authorizeOutstandSite } from "./outstand-access"
import { accountIdSchema, isRecord, matchesOutstandSite, OutstandBoundaryError, outstandFailure, siteIdSchema } from "./outstand-contract"
import { OUTSTAND_TIMEOUT_MS, requestOutstandPost } from "./outstand-http"
import { getLinkedOutstandPostIds } from "./delete-content-types"
import { buildContentDeletionPreview, type ContentDeletionPreviewResult, type DeletionPostSnapshot } from "./content-deletion-preview"

const contentSchema = z.object({ id: siteIdSchema, site_id: siteIdSchema, tags: z.array(z.string()).nullable() })
const postSchema = z.object({
  id: accountIdSchema,
  publishedAt: z.string().max(100).nullable(),
  scheduledAt: z.string().max(100).nullable(),
  isDraft: z.boolean(),
  socialAccounts: z.array(z.object({
    id: accountIdSchema,
    network: z.string().trim().min(1).max(100),
    username: z.string().trim().min(1).max(256),
    status: z.string().min(1).max(100),
    platformPostId: z.string().min(1).max(256).nullable(),
    publishedAt: z.string().max(100).nullable(),
  })).min(1).max(100),
})

function parseSnapshot(value: unknown, siteId: string, postId: string): DeletionPostSnapshot {
  const invalid = () => new OutstandBoundaryError(502, "Unable to verify linked social posts.")
  if (!isRecord(value) || value.success !== true || value.error || value.degraded === true ||
    !matchesOutstandSite(value, siteId) || !isRecord(value.post) || !matchesOutstandSite(value.post, siteId)) throw invalid()
  const parsed = postSchema.safeParse(value.post)
  if (!parsed.success || parsed.data.id !== postId) throw invalid()
  if ((value.post.socialAccounts as unknown[]).some(account =>
    !isRecord(account) || !matchesOutstandSite(account, siteId)) ||
    new Set(parsed.data.socialAccounts.map(account => account.id)).size !== parsed.data.socialAccounts.length) throw invalid()
  return parsed.data
}

export async function getContentDeletionPreview(contentId: string): Promise<ContentDeletionPreviewResult> {
  const input = siteIdSchema.safeParse(contentId)
  if (!input.success) return { success: false, status: 400, error: "Invalid content ID." }
  try {
    const supabase = await createClient(true)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) throw new OutstandBoundaryError(401, "Sign in to review content deletion.")
    const { data, error } = await supabase.from("content")
      .select("id, site_id, tags").eq("id", input.data).maybeSingle()
    if (error) throw new OutstandBoundaryError(503, "Unable to load content for deletion.")
    if (!data) throw new OutstandBoundaryError(404, "Content not found or access denied.")
    const parsed = contentSchema.safeParse(data)
    if (!parsed.success || parsed.data.id !== input.data) throw new OutstandBoundaryError(502, "Unable to verify content.")
    const content = parsed.data
    if (!await userCanOnSite(supabase, content.site_id, "delete")) {
      throw new OutstandBoundaryError(403, "You do not have permission to delete this content.")
    }
    const ids = getLinkedOutstandPostIds(content.tags)
    if (ids.length > 100 || ids.some(id => !accountIdSchema.safeParse(id).success)) {
      throw new OutstandBoundaryError(400, "Unable to verify linked social posts.")
    }
    if (!ids.length) return { success: true, data: buildContentDeletionPreview([]) }
    const access = await authorizeOutstandSite(content.site_id, "select")
    const posts: DeletionPostSnapshot[] = []
    const deadline = Date.now() + OUTSTAND_TIMEOUT_MS
    // Read exact persisted links, not a truncated list or text/title matches.
    // The API independently verifies each post's account ownership.
    for (let index = 0; index < ids.length; index += 5) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new OutstandBoundaryError(504, "Verification timed out. Reopen the dialog to check again.")
      const batch = await Promise.all(ids.slice(index, index + 5).map(async id =>
        parseSnapshot(await requestOutstandPost(access.siteId, access.token, id, remaining), access.siteId, id)))
      posts.push(...batch)
    }
    return { success: true, data: buildContentDeletionPreview(posts) }
  } catch (error) {
    return outstandFailure(error, "Unable to verify linked social posts.")
  }
}