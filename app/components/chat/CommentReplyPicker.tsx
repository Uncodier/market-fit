"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import type { CommentReplySelection } from '@/app/hooks/useCommentReplySelection'
import { parseSocialCommentContext } from '@/lib/chat/social-comment-context'

export function CommentReplyPicker({ selection, disabled }: { selection: CommentReplySelection; disabled: boolean }) {
  const selectedPost = parseSocialCommentContext(selection.target?.metadata)
  return (
    <div className="mb-2 space-y-2 rounded-lg border bg-muted/30 p-3">
      <Select value={selection.target?.id || ''} onValueChange={selection.select} disabled={disabled || !selection.options.length}>
        <SelectTrigger aria-label="Comment to reply to" className="h-9 bg-background">
          <SelectValue placeholder="Select a comment to reply publicly" />
        </SelectTrigger>
        <SelectContent>
          {selection.options.map(message => (
            <SelectItem key={message.id} value={message.id!}>
              <span className="truncate">{parseSocialCommentContext(message.metadata)?.postTitle || parseSocialCommentContext(message.metadata)?.postId || 'Post unavailable'} · {message.text || 'Comment without text'}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedPost && <p className="truncate text-xs font-medium">Post: {selectedPost.postTitle || selectedPost.postId || 'Unavailable'}{selectedPost.publisherUsername ? ` · @${selectedPost.publisherUsername}` : ''}</p>}
      {selection.target ? (
        <blockquote className="max-h-20 overflow-y-auto border-l-2 border-primary/40 pl-3 text-xs text-muted-foreground whitespace-pre-wrap">
          {selection.target.text || 'Comment without text'}
        </blockquote>
      ) : (
        <p className="text-xs text-muted-foreground">
          {selection.options.length ? 'Choose the original comment. Your reply will be public, not a DM.'
            : 'No replyable comment is available. Open the original post to reply.'}
        </p>
      )}
    </div>
  )
}