import type { DemoReportRow } from "./report-types"

const networks = ["instagram", "facebook", "linkedin", "x"] as const
const topics = ["Customer spotlight", "Product walkthrough", "Community update", "Behind the scenes"]

/** Linked publication cohorts and inbound comments, separate from operational activity. */
export function attachDemoSocial(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const site = data.sites?.[0]
  if (!site) return data

  const prefix = `${site.id}-social-`
  const result = { ...data }
  for (const table of ["content", "content_performance", "messages", "conversations"]) {
    result[table] = (data[table] || []).filter(row => !row.id.startsWith(prefix))
  }
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const leads = (data.leads || []).filter(row => row.site_id === site.id)
  const siteScale = site.id === "demo-saas-en-123" ? 3 : site.id === "demo-ecom-es-456" ? 5 : 2

  for (const [index, daysAgo] of [0, 2, 5, 9, 14, 21, 28, 35, 42, 49, 56, 70, 90, 120, 180, 240, 300, 365, 400, 540, 700].entries()) {
    const id = `${prefix}${index}`
    const publishedAt = stamp(daysAgo)
    const contentId = `${id}-content`
    const postId = `${id}-post`
    const network = networks[index % networks.length]
    const lead = leads[index % Math.max(leads.length, 1)]
    const views = (900 + index * 47) * siteScale
    const likes = (42 + index * 3) * siteScale
    const comments = (8 + index) * siteScale
    const shares = (6 + index) * siteScale
    const reach = Math.round(views * 0.8)
    const impressions = Math.round(views * 1.4)
    const engagementRate = (likes + comments + shares) / reach
    const title = `${topics[index % topics.length]} ${index + 1}`
    result.content.push({
      id: contentId, site_id: site.id, user_id: site.user_id, segment_id: lead?.segment_id,
      title, description: "A sample social publication sharing customer stories and product updates.",
      type: index % 2 ? "video" : "social_post", status: "published", published_at: publishedAt,
      scheduled_at: publishedAt, created_at: publishedAt, updated_at: publishedAt,
      output: { outstand_post_id: postId, networks: [network] },
    })
    const performance = {
      site_id: site.id, content_id: contentId, outstand_post_id: postId,
      views, likes, comments, shares, reach, impressions, engagement_rate: engagementRate,
      metrics_by_account: [{
        account_id: `${prefix}${network}-account`, network, account_name: `${site.name || "Sample workspace"} ${network}`,
        views, likes, comments, shares, reach, impressions, engagement_rate: engagementRate,
        fetched_at: stamp(0),
      }],
      fetched_at: stamp(0), created_at: publishedAt,
    }
    result.content_performance.push({ id: `${id}-snapshot`, ...performance })

    // Older refreshes exercise the same latest-snapshot selection as the real report.
    if (index % 5 === 0) result.content_performance.push({
      ...performance, id: `${id}-snapshot-previous`, views: Math.floor(views * 0.8), fetched_at: stamp(1),
    })
    const conversationId = `${id}-conversation`
    result.conversations.push({
      id: conversationId, site_id: site.id, user_id: site.user_id, channel: network,
      title: `${title} comments`, status: "active", is_archived: false,
      created_at: publishedAt, updated_at: publishedAt, last_message_at: publishedAt,
      custom_data: { origin: network, content_id: contentId, outstand_post_id: postId },
    })
    for (let commentIndex = 0; commentIndex < 2 + index % 3; commentIndex++) {
      const customer = leads[(index + commentIndex) % Math.max(leads.length, 1)]
      const customerId = customer?.id || `${prefix}customer-${commentIndex}`
      const name = customer?.name || ["Alex Morgan", "Jordan Taylor", "Casey Parker"][commentIndex % 3]
      result.messages.push({
        id: `${id}-comment-${commentIndex}`, site_id: site.id, conversation_id: conversationId,
        lead_id: customer?.id, visitor_id: null, role: "visitor", content: "Thanks for sharing this helpful update!",
        created_at: publishedAt, custom_data: {
          origin: network, network, content_id: contentId, outstand_post_id: postId,
          platform_comment_id: `${id}-provider-comment-${commentIndex}`,
          author_id: customerId, author_name: name,
          author: { id: customerId, name, username: `sample_customer_${commentIndex}` },
        },
      })
    }
  }
  return result
}