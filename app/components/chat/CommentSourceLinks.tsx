"use client"

import * as Icons from "@/app/components/ui/icons"

export function CommentSourceLinks({
  contentId,
  outstandPostId,
  platformPostUrl,
}: {
  contentId?: string
  outstandPostId?: string
  platformPostUrl?: string
}) {
  return (
    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 text-xs">
      {platformPostUrl ? (
        <a
          href={platformPostUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <Icons.ExternalLink className="w-3 h-3" />
          View thread
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Icons.MessageSquare className="w-3 h-3" />
          Comment thread
        </span>
      )}
      {contentId ? (
        <a
          href={`/content/${contentId}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <Icons.FileText className="w-3 h-3" />
          Open post
        </a>
      ) : outstandPostId ? (
        <a
          href={`/content?search=${outstandPostId}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <Icons.FileText className="w-3 h-3" />
          Open post
        </a>
      ) : null}
    </div>
  )
}
