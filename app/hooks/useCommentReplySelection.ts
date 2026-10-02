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
  const [selection, setSelection] = useState<{ scope: string; id: string | null } | null>(null)
  const isCommentConversation = isSocialCommentConversation(conversationCustomData, messages)
  const options = useMemo(() => isCommentConversation ? messages.filter(message => {
    const context = parseSocialCommentContext(message.metadata)
    return message.role === 'user' && typeof message.id === 'string' && uuid.test(message.id) &&
      message.metadata?.source === 'comment' && Boolean(context?.commentId && context.postId && context.socialAccountId && context.network)
  }).sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime() || 0
    const rightTime = new Date(right.timestamp).getTime() || 0
    return rightTime - leftTime
  }) : [], [isCommentConversation, messages])
  // Scope is checked during render, not in an effect: a fast switch must never
  // reuse a selected recipient from the previous conversation or site.
  const scopedSelection = selection?.scope === scope ? selection : null
  const target = scopedSelection?.id
    ? options.find(message => message.id === scopedSelection.id)
    : options[0]

  // Pin the initial default once comments load. New arrivals or a deleted target
  // must not silently change the destination of a reply being composed.
  if (selection?.scope !== scope || (!selection.id && target?.id)) {
    setSelection({ scope, id: target?.id ?? null })
  }
  return {
    isCommentConversation,
    options,
    target,
    select: (id: string) => setSelection({ scope, id }),
  }
}

export type CommentReplySelection = Pick<ReturnType<typeof useCommentReplySelection>, 'options' | 'target' | 'select'>