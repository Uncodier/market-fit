import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { UpdateConversations } from './useConversationRealtime'

export function useConversationListEvents(enabled: boolean, selected: string | undefined, update: UpdateConversations) {
  const router = useRouter()
  useEffect(() => {
    if (!enabled) return
    const deleted = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail
      update(rows => rows.filter(row => row.id !== conversationId))
      if (selected === conversationId) router.push('/chat')
    }
    const accepted = (event: Event) => {
      const { conversationId } = (event as CustomEvent).detail
      update(rows => rows.map(row => row.id === conversationId ? { ...row, hasAcceptedMessage: true } : row))
    }
    const changedLead = (event: Event) => {
      const { conversationId, newStatus } = (event as CustomEvent).detail
      update(rows => rows.map(row => row.id === conversationId && row.leadName ? { ...row, leadStatus: newStatus } : row))
    }
    window.addEventListener('conversation:deleted', deleted)
    window.addEventListener('conversation:message-accepted', accepted)
    window.addEventListener('lead:status-updated', changedLead)
    return () => {
      window.removeEventListener('conversation:deleted', deleted)
      window.removeEventListener('conversation:message-accepted', accepted)
      window.removeEventListener('lead:status-updated', changedLead)
    }
  }, [enabled, selected, update, router])
}