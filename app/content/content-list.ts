import { type ContentItem } from "./actions"
import { type ContentFilters } from "./content-shared"

export function combineOutstandContent(
  contentItems: ContentItem[],
  outstandPosts: any[],
  siteId?: string,
): ContentItem[] {
  const newItems = [...contentItems]
  if (!outstandPosts?.length) return newItems

  outstandPosts.forEach((post) => {
    const postText = post.containers?.[0]?.content || post.text || ""
    const isMatched = contentItems.some((item) => {
      if (item.tags?.includes(`outstand_id_${post.id}`)) return true
      return postText && item.title && (
        postText.includes(item.title) ||
        (item.description && postText.includes(item.description.substring(0, 50)))
      )
    })

    if (!isMatched && postText) {
      const platforms = post.socialAccounts?.map((a: any) => a.network || (typeof a === "string" ? a : null)).filter(Boolean) || []
      const publishedTags = platforms.map((p: string) => `published_${p}`)
      newItems.push({
        id: `outstand-${post.id}`,
        title: postText.substring(0, 50) + (postText.length > 50 ? "..." : ""),
        description: postText,
        type: "social_post",
        content: postText,
        text: postText,
        instructions: null,
        status: post.isDraft ? "draft" : (post.scheduledAt ? "approved" : "published"),
        segment_id: null,
        campaign_id: null,
        site_id: siteId || "",
        author_id: null,
        user_id: null,
        created_at: post.createdAt || new Date().toISOString(),
        updated_at: post.createdAt || new Date().toISOString(),
        published_at: post.publishedAt || null,
        tags: ["outstand_only", `outstand_id_${post.id}`, ...publishedTags],
        word_count: postText.split(" ").length,
        estimated_reading_time: 1,
        seo_score: null,
        performance_rating: null,
        assets: post.containers?.[0]?.media?.map((m: any) => ({
          id: m.id,
          file_path: m.url || m.thumbnailUrl || "",
          file_type: m.type || "image/jpeg",
          is_primary: true,
        })) || [],
      } as ContentItem)
    }
  })

  return newItems
}

export function filterAndSortContent(
  items: ContentItem[],
  searchTerm: string,
  filters: ContentFilters,
  sortBy: "newest" | "oldest" | "rate_desc" | "rate_asc",
): ContentItem[] {
  const searchLower = searchTerm.toLowerCase()
  const filtered = items.filter((item) => {
    const matchesSearch = searchTerm === "" ||
      item.title.toLowerCase().includes(searchLower) ||
      (item.description && item.description.toLowerCase().includes(searchLower))
    const matchesStatus = filters.status.length === 0 || filters.status.includes(item.status)
    const matchesType = filters.type.length === 0 || filters.type.includes(item.type)
    const matchesSegment = filters.segments.length === 0 ||
      (item.segment_id && filters.segments.includes(item.segment_id))
    return matchesSearch && matchesStatus && matchesType && matchesSegment
  })

  return filtered.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    const rateA = a.performance_rating ?? 0
    const rateB = b.performance_rating ?? 0
    if (sortBy === "newest") return dateB - dateA
    if (sortBy === "oldest") return dateA - dateB
    if (sortBy === "rate_desc") return rateB !== rateA ? rateB - rateA : dateB - dateA
    if (sortBy === "rate_asc") return rateA !== rateB ? rateA - rateB : dateB - dateA
    return 0
  })
}
