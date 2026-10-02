"use client"

import { createContext, useContext, type ReactNode } from "react"
import { ExternalLink } from "@/app/components/ui/icons"
import type { ChatMessage } from "@/app/types/chat"
import { resolveCommentReplyContext } from "@/lib/chat/social-comment-context"

const CommentDisplayContext = createContext<{
  messages: ChatMessage[]
  isCommentConversation: boolean
  showMessagePostContext: boolean
}>({ messages: [], isCommentConversation: false, showMessagePostContext: true })

export function CommentDisplayProvider({ children, ...value }: {
  children: ReactNode
  messages: ChatMessage[]
  isCommentConversation: boolean
  showMessagePostContext: boolean
}) {
  return <CommentDisplayContext.Provider value={value}>{children}</CommentDisplayContext.Provider>
}

export function useCommentDisplayContext() {
  return useContext(CommentDisplayContext)
}

export function CommentReplyContext({ message }: { message: ChatMessage }) {
  const { messages, isCommentConversation } = useCommentDisplayContext()
  const reply = resolveCommentReplyContext(message, messages, isCommentConversation)
  if (!reply) return null

  return (
    <aside aria-label="Replied-to comment" className="border-l-2 border-primary/30 pl-3 py-1 text-xs">
      <p className="font-medium text-muted-foreground">
        {reply.authorName ? `Replying to ${reply.authorName}` : "Replying to comment"}
      </p>
      {reply.availability === "available" ? (
        <blockquote className="mt-1 whitespace-pre-wrap break-words text-foreground/80">{reply.text}</blockquote>
      ) : (
        <p className="mt-1 text-muted-foreground">Reply context unavailable</p>
      )}
      {reply.url && (
        <a href={reply.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1 text-muted-foreground hover:text-primary">
          <ExternalLink className="h-3 w-3" />View comment
        </a>
      )}
    </aside>
  )
}