import { createContext } from 'react'
import type { WorkspaceRequestScope } from '@/app/context/site-types'

/** Only the user-scoped conversation index is independent of workspace settings. */
export const ConversationListReadScope = createContext<WorkspaceRequestScope | null>(null)

/** An admitted legacy inbox may keep its own rows, but cannot start new reads. */
export const ConversationListCacheOnly = createContext(false)

export function isConversationListKey(key: unknown): key is [string, string, string, string, string] {
  return Array.isArray(key) && key.length === 5 && key[0] === 'conversations' &&
    key.slice(1).every(part => typeof part === 'string')
}