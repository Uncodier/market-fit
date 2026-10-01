import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import { buildConversationListItems } from '@/app/services/conversations/conversation-list-items'
import type { ConversationListRow } from '@/app/services/conversations/conversation-list-query'
import type { ConversationListItem } from '@/app/types/chat'

export type UpdateConversations = (updater: (previous: ConversationListItem[]) => ConversationListItem[]) => void
type ConversationPayload = { new: Record<string, unknown>; old: { id?: string } }

export function useConversationRealtime({
  siteId, selectedConversationId, updateConversations, refreshConversations, onLoadConversations,
}: {
  siteId: string
  selectedConversationId?: string
  updateConversations: UpdateConversations
  refreshConversations: () => Promise<void>
  onLoadConversations?: (refresh: () => Promise<void>) => void
}) {
  const router = useRouter()
  const { mutate } = useSWRConfig()

  useEffect(() => {
    onLoadConversations?.(refreshConversations)
  }, [onLoadConversations, refreshConversations])

  useEffect(() => {
    if (!siteId) return
    const supabase = createClient()
    let active = true

    const update = async (row: ConversationListRow & { is_archived?: boolean; last_message?: string }, insert: boolean) => {
      if (!row.id || !active) return
      // Refresh the header's site-scoped read, never write or sync with the provider on view.
      if (row.id === selectedConversationId) void mutate(['lead-data', row.id, siteId])
      if (row.is_archived) {
        updateConversations(previous => previous.filter(item => item.id !== row.id))
        return
      }
      try {
        // Use the same identity and moderation mapping as initial load and pagination.
        const [item] = await buildConversationListItems(supabase, [row])
        item.lastMessage = item.lastMessage ?? row.last_message
        if (!active) return
        updateConversations(previous => {
          const exists = previous.some(conversation => conversation.id === item.id)
          if (!exists) return insert ? [item, ...previous] : previous
          return previous.map(conversation => conversation.id === item.id
            ? { ...conversation, ...item, lastMessage: item.lastMessage ?? conversation.lastMessage }
            : conversation)
        })
      } catch {
        if (active) void refreshConversations()
      }
    }

    try {
      const channel = supabase.channel(`conversations-${siteId}`, { config: { broadcast: { self: false } } })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `site_id=eq.${siteId}` },
          (payload: ConversationPayload) => { void update(payload.new as unknown as ConversationListRow, false) })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `site_id=eq.${siteId}` },
          (payload: ConversationPayload) => { void update(payload.new as unknown as ConversationListRow, true) })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'conversations', filter: `site_id=eq.${siteId}` },
          (payload: ConversationPayload) => {
            if (!active) return
            updateConversations(previous => previous.filter(item => item.id !== payload.old.id))
            if (selectedConversationId === payload.old.id) router.push('/chat')
          })
        .subscribe()

      return () => {
        active = false
        void supabase.removeChannel(channel)
      }
    } catch {
      // Keep the normal list read usable if realtime is unavailable.
      active = false
      console.warn('Conversation realtime is unavailable')
    }
  }, [siteId, selectedConversationId, updateConversations, refreshConversations, router, mutate])
}