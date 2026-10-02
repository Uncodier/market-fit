import { Card } from "@/app/components/ui/card"
import { MessageSquare } from "@/app/components/ui/icons"
import { getChannelLabel } from "@/lib/site-channels"
import { getCommentPostReference, type SocialCommentContext } from "@/lib/chat/social-comment-context"
import { CommentSourceLinks } from "./CommentSourceLinks"

export function PostContextCard({ context, compact = false }: {
  context: SocialCommentContext
  compact?: boolean
}) {
  return (
    <Card
      aria-label={compact ? "Message post context" : "Conversation post context"}
      className={compact ? "p-3 bg-muted/30 shadow-none" : "p-4 bg-muted/30 shadow-none"}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span>{context.network ? `${getChannelLabel(context.network)} comments` : "Social comments"}</span>
        {context.publisherUsername && (
          <span className="truncate">· Owned account: {context.publisherUsername}</span>
        )}
      </div>
      <h3 className="font-medium text-sm break-words">{getCommentPostReference(context)}</h3>
      {context.postText && context.postTitle && (
        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-3">
          {context.postText}
        </p>
      )}
      {!context.postTitle && !context.postText && (
        <p className="text-xs text-muted-foreground mt-1">Post preview unavailable</p>
      )}
      <CommentSourceLinks
        contentId={context.contentId}
        outstandPostId={context.postId}
        platformPostUrl={context.postUrl}
      />
    </Card>
  )
}