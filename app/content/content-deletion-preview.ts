export type DeletionAccountSnapshot = {
  network: string
  username: string
  status: string
  platformPostId: string | null
  publishedAt: string | null
}

export type DeletionPostSnapshot = {
  id: string
  publishedAt: string | null
  scheduledAt: string | null
  isDraft: boolean
  socialAccounts: DeletionAccountSnapshot[]
}

export type DeletionDisposition = "remote" | "manual" | "scheduled" | "unpublished" | "deleted" | "unknown"

export type DeletionPreviewAccount = {
  network: string
  label: string
  username: string
  disposition: DeletionDisposition
}

export type ContentDeletionPreview = {
  linkedPostCount: number
  accounts: DeletionPreviewAccount[]
  canDeleteRemotely: boolean
}

export type ContentDeletionPreviewResult =
  | { success: true; data: ContentDeletionPreview }
  | { success: false; error: string; status?: number }

// Keep this allowlist and the scheduling guard aligned with the adjacent API's
// src/lib/integrations/outstand/post-deletion.ts, without importing server code.
const REMOTE_NETWORKS = new Set([
  "x", "linkedin", "facebook", "threads", "youtube", "pinterest", "google_business", "vimeo", "reddit", "bluesky",
])
const NETWORK_LABELS = new Map([
  ["x", "X"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["threads", "Threads"],
  ["youtube", "YouTube"],
  ["pinterest", "Pinterest"],
  ["google_business", "Google Business"],
  ["vimeo", "Vimeo"],
  ["reddit", "Reddit"],
  ["bluesky", "Bluesky"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
])
const DELETION_WINDOW_MS = 75_000

function canonicalNetwork(network: string): string {
  const value = network.toLowerCase()
  return value === "twitter" ? "x" : value
}

function isPostUncertain(post: DeletionPostSnapshot, now: number): boolean {
  const identities = new Set<string>()
  let pending = false
  let publishedOrDeleted = false

  for (const account of post.socialAccounts) {
    const identity = JSON.stringify([account.network, account.username])
    if (identities.has(identity)) return true
    identities.add(identity)

    if (account.status === "published" || account.status === "deleted") publishedOrDeleted = true
    if (account.status === "pending" || account.status === "failed") {
      // Only explicit nulls prove that these accounts were not published.
      if (account.platformPostId !== null || account.publishedAt !== null) return true
      if (account.status === "pending") pending = true
    }
  }

  if (pending) {
    const safelyScheduled = typeof post.scheduledAt === "string"
      && Date.parse(post.scheduledAt) > now + DELETION_WINDOW_MS
    if (publishedOrDeleted || post.publishedAt !== null || (post.isDraft !== true && !safelyScheduled)) return true
  }
  return !publishedOrDeleted && post.publishedAt !== null
}

function accountDisposition(account: DeletionAccountSnapshot, isDraft: boolean): DeletionDisposition {
  switch (account.status) {
    case "published":
      if (typeof account.platformPostId !== "string" || account.platformPostId.trim().length === 0) return "unknown"
      if (account.network === "instagram" || account.network === "tiktok") return "manual"
      return REMOTE_NETWORKS.has(account.network) ? "remote" : "unknown"
    case "pending":
      // Post-level checks have already ruled out in-progress or inconsistent publication.
      return isDraft === true ? "unpublished" : "scheduled"
    case "failed":
      return "unpublished"
    case "deleted":
      return "deleted"
    default:
      return "unknown"
  }
}

/** Preview validated GET snapshots only; deletion still requires fresh API checks. */
export function buildContentDeletionPreview(
  posts: DeletionPostSnapshot[], now = Date.now(),
): ContentDeletionPreview {
  const accounts = posts.flatMap(post => {
    const normalizedPost = {
      ...post,
      socialAccounts: post.socialAccounts.map(account => ({
        ...account, network: canonicalNetwork(account.network),
      })),
    }
    const uncertain = isPostUncertain(normalizedPost, now)
    return normalizedPost.socialAccounts.map((account): DeletionPreviewAccount => ({
      network: account.network,
      label: NETWORK_LABELS.get(account.network) ?? "Unknown network",
      username: account.username,
      disposition: uncertain ? "unknown" : accountDisposition(account, post.isDraft),
    }))
  })

  return {
    linkedPostCount: posts.length,
    accounts,
    canDeleteRemotely: posts.length > 0 && accounts.length > 0
      && posts.every(post => post.socialAccounts.length > 0)
      && accounts.every(account => account.disposition !== "manual" && account.disposition !== "unknown"),
  }
}
