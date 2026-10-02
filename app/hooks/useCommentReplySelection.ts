"use client"

import { useMemo, useState } from 'react'
import type { ChatMessage } from '@/app/types/chat'
import { isSocialCommentConversation, parseSocialCommentContext } from '@/lib/chat/social-comment-context'

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export function useCommentReplySelection(
  conversationId: string,
  siteId: string | undefined,
  conversationCustomData: unknown,
  messages: ChatMessage[],
) {
  const scope = JSON.stringify([siteId, conversationId])
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null)
  const isCommentConversation = isSocialCommentConversation(conversationCustomData, messages)
  const options = useMemo(() => isCommentConversation ? messages.filter(message => {
    const context = parseSocialCommentContext(message.metadata)
    return message.role === 'user' && typeof message.id === 'string' && uuid.test(message.id) &&
      message.metadata?.source === 'comment' && Boolean(context?.commentId && context.postId && context.socialAccountId && context.network)
  }) : [], [isCommentConversation, messages])
  // Scope is checked during render, not in an effect: a fast switch must never
  // reuse a selected recipient from the previous conversation or site.
  const target = selection?.scope === scope ? options.find(message => message.id === selection.id) : undefined
  return {
    isCommentConversation,
    options,
    target,
    select: (id: string) => setSelection({ scope, id }),
  }
}

export type CommentReplySelection = Pick<ReturnType<typeof useCommentReplySelection>, 'options' | 'target' | 'select'>