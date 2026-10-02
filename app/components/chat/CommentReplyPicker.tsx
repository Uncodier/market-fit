"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { buttonVariants } from '@/app/components/ui/button'
import { MessageSquare } from '@/app/components/ui/icons'
import type { CommentReplySelection } from '@/app/hooks/useCommentReplySelection'
import { parseSocialCommentContext } from '@/lib/chat/social-comment-context'
import { cn } from '@/lib/utils'

export function CommentReplyPicker({ selection, disabled }: { selection: CommentReplySelection; disabled: boolean }) {
  const selectedPost = parseSocialCommentContext(selection.target?.metadata)
  const selectedText = selection.target?.text || 'Comment without text'
  return (
    <Select value={selection.target?.id || ''} onValueChange={selection.select} disabled={disabled || !selection.options.length}>
      <SelectTrigger
        aria-label="Comment to reply to"
        title={selection.target
          ? `Reply publicly to: ${selectedText}\nPost: ${selectedPost?.postTitle || selectedPost?.postId || 'Unavailable'}`
          : 'Select a comment to reply publicly'}
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'sm' }),
          'h-8 w-auto max-w-full gap-2 border-0 px-3 focus:ring-0 focus-visible:ring-2',
        )}
      >
        <span className="safari-icon-fix flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
          <MessageSquare className="h-4 w-4 text-blue-600" />
        </span>
        <SelectValue placeholder={selection.options.length ? 'Select comment' : 'No comments available'}>
          <span>{selection.target ? `Comment: ${selectedText}` : null}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent side="top" align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        {selection.options.map(message => {
          const post = parseSocialCommentContext(message.metadata)
          const text = message.text || 'Comment without text'
          const postLabel = `${post?.postTitle || post?.postId || 'Post unavailable'}${post?.publisherUsername ? ` · @${post.publisherUsername}` : ''}`
          return (
            <SelectItem key={message.id} value={message.id!} textValue={`${text} ${postLabel}`} title={`${text}\n${postLabel}`}>
              <span className="min-w-0 space-y-1 py-1">
                <span className="block break-words whitespace-pre-wrap text-sm leading-snug">{text}</span>
                <span className="block break-words text-xs leading-snug text-muted-foreground">{postLabel}</span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}