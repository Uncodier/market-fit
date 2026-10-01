import "server-only"
import { z } from "zod"
import { isRecord, matchesOutstandSite, OutstandBoundaryError, UNCONFIRMED_DELETE, UNCONFIRMED_PUBLISH } from "./outstand-contract"
import { isOutstandMediaUrl } from "./outstand-media"

const text = z.string().max(100_000)
const identifier = z.string().min(1).max(256)
const nullableText = text.nullable().optional()
const socialAccountSchema = z.object({
  id: identifier.optional(),
  platform: text.optional(),
  network: text.optional(),
  nickname: text.optional(),
  username: text.optional(),
  status: text.optional(),
  platformPostId: identifier.optional(),
  publishedAt: nullableText,
  // Provider error strings can contain credentials and request details.
  error: z.unknown().transform(value => value ? "Social account delivery failed." : undefined),
})
const mediaSchema = z.object({
  id: z.union([identifier, z.number().finite()]).optional(),
  url: z.string().max(8192).refine(isOutstandMediaUrl).optional(),
  thumbnailUrl: z.string().max(8192).refine(isOutstandMediaUrl).optional(),
  filename: text.optional(),
  type: text.optional(),
})
const postSchema = z.object({
  id: identifier,
  publishedAt: nullableText,
  scheduledAt: nullableText,
  isDraft: z.boolean().optional(),
  createdAt: text.optional(),
  text: text.optional(),
  socialAccounts: z.array(socialAccountSchema).max(100).optional(),
  containers: z.array(z.object({
    id: identifier.optional(),
    content: text,
    media: z.array(mediaSchema).max(20).optional(),
  })).max(20).optional(),
})

type Post = z.infer<typeof postSchema>
type PublishData = {
  success: true; post?: Post; data?: Post; id?: string; socialAccounts?: Post["socialAccounts"]
}

function invalidResponse(message = "The social publishing API returned an invalid response."): never {
  throw new OutstandBoundaryError(502, message)
}

function parsePost(value: unknown, siteId: string): Post {
  if (!isRecord(value) || !matchesOutstandSite(value, siteId)) invalidResponse()
  if (Array.isArray(value.socialAccounts) && value.socialAccounts.some(account =>
    !isRecord(account) || !matchesOutstandSite(account, siteId))) invalidResponse()
  const parsed = postSchema.safeParse(value)
  if (!parsed.success) invalidResponse()
  return parsed.data
}

function envelope(value: unknown, siteId: string): Record<string, unknown> {
  if (!isRecord(value) || value.success !== true || value.error || !matchesOutstandSite(value, siteId)) {
    invalidResponse()
  }
  return value
}

export function parseOutstandPublished(value: unknown, siteId: string): PublishData {
  const result = envelope(value, siteId)
  const key = "post" in result ? "post" : "data" in result ? "data" : null
  const post = parsePost(key ? result[key] : result, siteId)
  if (post.isDraft || post.socialAccounts?.some(account => account.error || account.status === "failed")) {
    invalidResponse(UNCONFIRMED_PUBLISH)
  }
  // Preserve the caller's post/data/root fallbacks, but never return raw provider objects.
  return key ? { success: true, [key]: post } : { ...post, success: true }
}

export function parseOutstandPosts(value: unknown, siteId: string): Post[] {
  const result = envelope(value, siteId)
  const posts = "posts" in result ? result.posts : result.data
  if (!Array.isArray(posts) || posts.length > 50) invalidResponse()
  return posts.map(post => parsePost(post, siteId))
}

export function parseOutstandDeleted(value: unknown, siteId: string, postId: string): void {
  const result = envelope(value, siteId)
  if (result.post_id !== postId || result.delete_remote !== true || result.degraded === true ||
    ("results" in result && (!Array.isArray(result.results) || result.results.some(row =>
      !isRecord(row) || row.status !== "deleted" || row.error)))) {
    invalidResponse(UNCONFIRMED_DELETE)
  }
}