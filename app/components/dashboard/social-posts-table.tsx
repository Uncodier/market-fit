"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"

type Post = {
  id: string; content_id: string | null; fetched_at: string
  content?: { title?: string | null; published_at?: string | null } | null
  views: number | null; reach: number | null; comments: number | null; likes: number | null; shares: number | null
  engagement_rate: number | null
  reportedEngagementRate?: number | null
}
type Sort = "engagement" | "views" | "comments" | "published"
const PAGE_SIZE = 10
const formatNumber = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US")
const publication = (post: Post) => post.content?.published_at ? Date.parse(post.content.published_at) : NaN

function engagement(post: Post) {
  if ("reportedEngagementRate" in post) return post.reportedEngagementRate ?? null
  const value = post.engagement_rate
  return value === null || !Number.isFinite(value) || value < 0 ? null : value > 1 ? value / 100 : value
}

export function SocialPostsTable({ posts, isLoading }: { posts: Post[]; isLoading: boolean }) {
  const [sort, setSort] = useState<Sort>("engagement")
  const [page, setPage] = useState(0)
  const ranked = useMemo(() => {
    const value = (post: Post) => sort === "engagement" ? engagement(post) : sort === "published" ? publication(post) : post[sort]
    return [...posts].sort((a, b) => (value(b) ?? -Infinity) - (value(a) ?? -Infinity) || a.id.localeCompare(b.id))
  }, [posts, sort])
  const lastPage = Math.max(0, Math.ceil(ranked.length / PAGE_SIZE) - 1)
  const visiblePage = Math.min(page, lastPage)
  const visible = ranked.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE)
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-wrap flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5"><CardTitle>Top Posts</CardTitle><CardDescription>Rank all matching posts by reported metrics. Missing values are not zero.</CardDescription></div>
        <label className="flex items-center gap-2 text-sm">Sort by
          <select aria-label="Sort social posts" value={sort} onChange={event => { setSort(event.target.value as Sort); setPage(0) }}
            className="rounded-md border bg-background px-3 py-2" disabled={isLoading}>
            <option value="engagement">Engagement rate</option><option value="views">Views</option>
            <option value="comments">Comments</option><option value="published">Publication date</option>
          </select>
        </label>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? <Skeleton className="h-40 w-full" /> : !posts.length ? <p className="py-8 text-center text-sm text-muted-foreground">No posts found</p> : <>
          <Table aria-label="Social post performance" className="table-auto min-w-[820px]">
            <TableHeader><TableRow>
              <TableHead scope="col">Post</TableHead><TableHead scope="col">Published</TableHead>
              {["Views", "Reach", "Engagement", "Likes", "Comments", "Shares"].map(label => <TableHead key={label} scope="col" className="text-right">{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{visible.map(post => {
              const rate = engagement(post)
              const title = post.content?.title || "Untitled post"
              return <TableRow key={post.id}>
                <TableCell className="max-w-64 break-words font-medium">
                  {post.content_id ? <Link className="hover:underline focus-visible:underline" href={`/content/${encodeURIComponent(post.content_id)}`}>{title}</Link> : title}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{Number.isFinite(publication(post))
                  ? new Date(publication(post)).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "UTC" }) : "Unknown"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(post.views)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(post.reach)}</TableCell>
                <TableCell className="text-right tabular-nums">{rate === null ? "—" : `${(rate * 100).toFixed(2)}%`}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(post.likes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(post.comments)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(post.shares)}</TableCell>
              </TableRow>
            })}</TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>{visiblePage * PAGE_SIZE + 1}–{Math.min((visiblePage + 1) * PAGE_SIZE, ranked.length)} of {ranked.length} posts · publication dates shown in UTC</p>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPage(visiblePage - 1)} disabled={visiblePage === 0}>Previous posts</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(visiblePage + 1)} disabled={visiblePage === lastPage}>Next posts</Button></div>
          </div>
        </>}
      </CardContent>
    </Card>
  )
}