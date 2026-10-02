"use client"

import * as Icons from "@/app/components/ui/icons"
import { getCommentContentHref, getSafeSocialUrl } from "@/lib/chat/social-comment-context"

export function CommentSourceLinks({
  contentId,
  outstandPostId,
  platformPostUrl,
}: {
  contentId?: string
  outstandPostId?: string
  platformPostUrl?: string
}) {
  const postUrl = getSafeSocialUrl(platformPostUrl)
  const contentHref = getCommentContentHref(contentId, outstandPostId)
  return (
    <div className="flex flex-wrap items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs">
      {postUrl ? (
        <a
          href={postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <Icons.ExternalLink className="w-3 h-3" />
          View post
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Icons.MessageSquare className="w-3 h-3" />
          Post link unavailable
        </span>
      )}
      {contentHref && (
        <a
          href={contentHref}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <Icons.FileText className="w-3 h-3" />
          Open content
        </a>
      )}
    </div>
  )
}
