import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getEnabledSiteChannels, leadHasChannel, normalizeChannel } from "@/lib/site-channels"

type Channel = 'web' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'telegram' | 'voice' | 'website_chat' | string


interface UseChannelSelectorProps {
  conversationId?: string
  leadData?: {
    id: string
    email?: string
    phone?: string
    social_networks?: Record<string, unknown> | null
  } | null
  isAgentOnlyConversation?: boolean
  defaultChannel?: Channel
}

interface UseChannelSelectorReturn {
  selectedChannel: Channel
  setSelectedChannel: (channel: Channel) => void
  availableChannels: Channel[]
  isUpdatingChannel?: boolean
  channelLoadError?: string
  retryChannelLoad?: () => void
}

export function useChannelSelector({
  conversationId,
  leadData,
  isAgentOnlyConversation = false,
  defaultChannel = 'web'
}: UseChannelSelectorProps): UseChannelSelectorReturn {
  const { currentSite } = useSite()
  const [selectedChannel, setSelectedChannelState] = useState<Channel>(defaultChannel)
  const [updatingOperations, setUpdatingOperations] = useState<Record<string, number>>({})
  const operationCounter = useRef(0)
  const pendingOperations = useRef(new Map<string, number>())
  const isUpdatingChannel = Boolean(conversationId && updatingOperations[conversationId] !== undefined)
  const [loadedConversationId, setLoadedConversationId] = useState<string>()
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadFailure, setLoadFailure] = useState<{ conversationId: string; message: string }>()
  const channelLoadError = loadFailure && loadFailure.conversationId === conversationId ? loadFailure.message : undefined
  const retryChannelLoad = useCallback(() => {
    setLoadFailure(undefined)
    setLoadedConversationId(undefined)
    setLoadAttempt(value => value + 1)
  }, [])
  const activeConversationRef = useRef(conversationId)
  useEffect(() => {
    activeConversationRef.current = conversationId
    return () => { activeConversationRef.current = undefined }
  }, [conversationId])

  // Log channel selection for diagnostics.
  console.log(`[useChannelSelector] Hook called - conversationId: ${conversationId}, selectedChannel: ${selectedChannel}`)

  // Memoize available channels calculation
  const availableChannels = useMemo(() => {
    const channels: Channel[] = ['web'] // Web chat is always available

    // Don't show other channels for agent-only conversations
    if (isAgentOnlyConversation) {
      return channels
    }

    const enabledChannels = getEnabledSiteChannels(currentSite)
    
    for (const channel of enabledChannels) {
      if (channel === 'web') continue // already added
      
      if (leadHasChannel(leadData, channel)) {
        channels.push(channel)
        console.log(`[availableChannels] Added ${channel} channel`)
      } else {
        console.log(`[availableChannels] ${channel} not available for lead`)
      }
    }

    // Historical selection is retained separately, never treated as channel availability.
    console.log(`[availableChannels] Final channels:`, channels)
    return channels
  }, [currentSite, leadData, isAgentOnlyConversation])

  // Enhanced setSelectedChannel with database update
  const setSelectedChannel = useCallback(async (channel: Channel) => {
    // Only update if the channel is available and different
    if (!availableChannels.includes(channel) || channel === selectedChannel
      || (conversationId && pendingOperations.current.has(conversationId))) {
      return
    }

    // If we have a valid conversation ID (not new conversation), update database
    if (conversationId && !conversationId.startsWith("new-")) {
      const token = ++operationCounter.current
      pendingOperations.current.set(conversationId, token)
      setUpdatingOperations(current => ({ ...current, [conversationId]: token }))
      
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        // Update both the direct channel field and custom_data for backward compatibility
        const { data: existingConversation, error: fetchError } = await supabase
          .from("conversations")
          .select("custom_data")
          .eq("id", conversationId)
          .single()

        if (activeConversationRef.current !== conversationId) return

        if (fetchError) {
          console.error("Error fetching conversation for channel update:", fetchError)
          return
        }

        const existingCustomData = existingConversation?.custom_data || {}
        const updatedCustomData = {
          ...existingCustomData,
          channel: channel
        }

        // Update both channel field and custom_data
        const { error: updateError } = await supabase
          .from("conversations")
          .update({ 
            channel: channel,
            custom_data: updatedCustomData,
            updated_at: new Date().toISOString()
          })
          .eq("id", conversationId)

        if (activeConversationRef.current !== conversationId) return

        if (updateError) {
          console.error("Error updating conversation channel:", updateError)
          return
        }

        console.log(`✅ Successfully updated conversation ${conversationId} channel to ${channel}`)
        
        // Update local state only after successful database update
        setSelectedChannelState(channel)
        
      } catch (error) {
        console.error("Unexpected error updating conversation channel:", error)
      } finally {
        if (pendingOperations.current.get(conversationId) === token) pendingOperations.current.delete(conversationId)
        // Completing A while viewing B must release A without clearing B's newer operation.
        setUpdatingOperations(current => {
          if (current[conversationId] !== token) return current
          const next = { ...current }
          delete next[conversationId]
          return next
        })
      }
    } else {
      // For new conversations, just update local state
      setSelectedChannelState(channel)
    }
  }, [availableChannels, selectedChannel, conversationId])

  // Get conversation's channel from database - run immediately when conversationId is available
  useEffect(() => {
    console.log(`[loadChannelEffect] conversationId: ${conversationId}`)
    
    // Skip if no conversation ID or it's a new conversation
    if (!conversationId || (conversationId && conversationId.startsWith("new-"))) {
      console.log(`[loadChannelEffect] Skipping - no conversation or new conversation`)
      // Reset to default for new conversations
      if (conversationId && conversationId.startsWith("new-")) {
        setSelectedChannelState('web')
      }
      return
    }

    console.log(`[loadChannelEffect] Processing conversation ${conversationId} (always load)`)
    let isCancelled = false

    async function getConversationChannel() {
      const fail = () => {
        if (!isCancelled) setLoadFailure({ conversationId: conversationId!,
          message: 'Unable to verify the conversation channel. Retry before sending.' })
      }
      try {
        console.log(`[getConversationChannel] Loading channel for conversation: ${conversationId}`)
        
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        const { data: conversation, error } = await supabase
          .from("conversations")
          .select("custom_data, channel")
          .eq("id", conversationId)
          .single()
          
        console.log(`[getConversationChannel] DB response for ${conversationId}:`, {
          conversation,
          error,
          isCancelled
        })
          
        // Don't update state if component was unmounted or conversation changed
        if (isCancelled || error || !conversation) {
          if (error) console.error("Error fetching conversation channel:", error)
          if (!isCancelled) fail()
          return
        }
        
        // Check the direct channel field first, then custom_data
        let conversationChannel: Channel = 'web'
        
        if (conversation.channel) {
          conversationChannel = conversation.channel as Channel
          console.log(`[getConversationChannel] Found channel in direct field: ${conversationChannel}`)
        } else if (conversation.custom_data?.channel) {
          conversationChannel = conversation.custom_data.channel as Channel
          console.log(`[getConversationChannel] Found channel in custom_data: ${conversationChannel}`)
        } else {
          console.log(`[getConversationChannel] No channel found in DB, defaulting to: ${conversationChannel}`)
        }
        
        // Normalize channels like website_chat to web, twitter to x
        conversationChannel = normalizeChannel(conversationChannel)
        
        console.log(`📺 Channel loaded from conversation ${conversationId}: ${conversationChannel}`)
        
        // Set the channel from database
        setSelectedChannelState(conversationChannel)
        setLoadedConversationId(conversationId)
        setLoadFailure(undefined)
      } catch (error) {
        if (!isCancelled) {
          console.error("Error getting conversation channel:", error)
          fail()
        }
      }
    }

    getConversationChannel()

    // Cleanup function to cancel the request if conversation changes
    return () => {
      isCancelled = true
    }
  }, [conversationId, loadAttempt])

  // Log current channel status for debugging
  useEffect(() => {
    console.log(`📺 Channel status:`, {
      selectedChannel,
      availableChannels,
      conversationId,
      isChannelAvailable: availableChannels.includes(selectedChannel)
    })
  }, [selectedChannel, availableChannels, conversationId])



  return {
    selectedChannel,
    setSelectedChannel,
    availableChannels,
    channelLoadError,
    retryChannelLoad,
    isUpdatingChannel: isUpdatingChannel || Boolean(channelLoadError)
      || Boolean(conversationId && !conversationId.startsWith('new-') && loadedConversationId !== conversationId)
  }
} 