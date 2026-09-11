const fs = require('fs');

const path = 'app/components/dashboard/social-actions.ts';
let code = fs.readFileSync(path, 'utf8');

const newFunction = `
export async function getTopCommentersData(siteId: string, startDate: Date, endDate: Date) {
  const { supabase, error: authError } = await requireUserClient()
  if (!supabase) return { error: authError, data: [] }

  const { start, end } = toDayRange(startDate, endDate)

  const { data, error } = await supabase
    .from("messages")
    .select("custom_data, visitor_id, lead_id, conversations!inner(site_id)")
    .eq("conversations.site_id", siteId)
    .not("custom_data->>outstand_post_id", "is", null)
    .in("role", ["visitor", "user"])
    .gte("created_at", new Date(start).toISOString())
    .lte("created_at", new Date(end).toISOString())
    .limit(2000)

  if (error) {
    console.error("Error fetching top commenters:", error)
    return { error: error.message, data: [] }
  }

  const commentersMap = new Map<string, { id: string; name: string; avatar: string | null; count: number }>()

  for (const row of data || []) {
    const cd = (row.custom_data as any) || {}
    const authorName = cd.author?.name || cd.from?.name || cd.author || cd.username || cd.from || "Anonymous Visitor"
    const authorId = cd.author?.id || cd.from?.id || row.lead_id || row.visitor_id || authorName
    const avatar = cd.author?.avatar || cd.from?.avatar || cd.avatar || cd.profile_image_url || null

    if (!commentersMap.has(authorId)) {
      commentersMap.set(authorId, { id: authorId, name: typeof authorName === 'string' ? authorName : "Anonymous Visitor", avatar, count: 0 })
    }
    commentersMap.get(authorId)!.count++
  }

  const sorted = Array.from(commentersMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { data: sorted }
}
`;

if (!code.includes('getTopCommentersData')) {
  fs.writeFileSync(path, code + '\n' + newFunction);
  console.log("Function added.");
} else {
  console.log("Function already exists.");
}
