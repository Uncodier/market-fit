import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSite } from "@/app/context/SiteContext"

type Channel = 'web' | 'email' | 'whatsapp'

interface UseChannelSelectorProps {
  conversationId?: string
  leadData?: {
    id: string
    email?: string
    phone?: string
  } | null
  isAgentOnlyConversation?: boolean
  defaultChannel?: Channel
}

interface UseChannelSelectorReturn {
  selectedChannel: Channel
  setSelectedChannel: (channel: Channel) => void
  availableChannels: Channel[]
  isUpdatingChannel?: boolean
}

export function useChannelSelector({
  conversationId,
  leadData,
  isAgentOnlyConversation = false,
  defaultChannel = 'web'
}: UseChannelSelectorProps): UseChannelSelectorReturn {
  const { currentSite } = useSite()
  const [selectedChannel, setSelectedChannelState] = useState<Channel>(defaultChannel)
  const [isUpdatingChannel, setIsUpdatingChannel] = useState(false)
  const lastConversationId = useRef<string | undefined>(undefined)
  const isInitialized = useRef(false)

  // Memoize site channels to avoid unnecessary recalculations
  const siteChannels = useMemo(() => 
    currentSite?.settings?.channels, 
    [currentSite?.settings?.channels]
  )

  // Memoize available channels calculation
  const availableChannels = useMemo(() => {
    const channels: Channel[] = ['web'] // Web chat is always available

    // Don't show other channels for agent-only conversations
    if (isAgentOnlyConversation) {
      return channels
    }

    // Check email channel availability
    if (siteChannels?.email?.enabled && 
        siteChannels.email.status === 'synced' &&
        leadData?.email) {
      channels.push('email')
    }

    // Check WhatsApp channel availability
    if (siteChannels?.whatsapp?.enabled && 
        siteChannels.whatsapp.status === 'active' &&
        leadData?.phone) {
      channels.push('whatsapp')
    }

    return channels
  }, [siteChannels, leadData?.email, leadData?.phone, isAgentOnlyConversation])

  // Enhanced setSelectedChannel with database update
  const setSelectedChannel = useCallback(async (channel: Channel) => {
    // Only update if the channel is available and different
    if (!availableChannels.includes(channel) || channel === selectedChannel) {
      return
    }

    // If we have a valid conversation ID (not new conversation), update database
    if (conversationId && !conversationId.startsWith("new-")) {
      setIsUpdatingChannel(true)
      
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        // Update both the direct channel field and custom_data for backward compatibility
        const { data: existingConversation, error: fetchError } = await supabase
          .from("conversations")
          .select("custom_data")
          .eq("id", conversationId)
          .single()

        if (fetchError) {
          console.error("Error fetching conversation for channel update:", fetchError)
          setIsUpdatingChannel(false)
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

        if (updateError) {
          console.error("Error updating conversation channel:", updateError)
          setIsUpdatingChannel(false)
          return
        }

        console.log(`✅ Successfully updated conversation ${conversationId} channel to ${channel}`)
        
        // Update local state only after successful database update
        setSelectedChannelState(channel)
        
      } catch (error) {
        console.error("Unexpected error updating conversation channel:", error)
      } finally {
        setIsUpdatingChannel(false)
      }
    } else {
      // For new conversations, just update local state
      setSelectedChannelState(channel)
    }
  }, [availableChannels, selectedChannel, conversationId])

  // Get conversation's channel from database - optimized to run only when needed
  useEffect(() => {
    // Skip if no conversation ID, it's a new conversation, or we already processed this conversation
    if (!conversationId || 
        conversationId.startsWith("new-") || 
        lastConversationId.current === conversationId) {
      return
    }

    let isCancelled = false
    lastConversationId.current = conversationId

    async function getConversationChannel() {
      try {
        const { createClient } = await import("@/lib/supabase/client")
        const supabase = createClient()
        
        const { data: conversation, error } = await supabase
          .from("conversations")
          .select("custom_data, channel")
          .eq("id", conversationId)
          .single()
          
        // Don't update state if component was unmounted or conversation changed
        if (isCancelled || error) {
          if (error) console.error("Error fetching conversation channel:", error)
          return
        }
        
        // Check the direct channel field first, then custom_data
        let conversationChannel: Channel = 'web'
        
        if (conversation.channel) {
          conversationChannel = conversation.channel as Channel
        } else if (conversation.custom_data?.channel) {
          conversationChannel = conversation.custom_data.channel as Channel
        }
        
        // Normalize website_chat to web since they are the same
        if (conversationChannel === 'website_chat' as any) {
          conversationChannel = 'web'
        }
        
        // Only set the channel if it's available for this conversation
        if (availableChannels.includes(conversationChannel)) {
          setSelectedChannelState(conversationChannel)
        } else {
          // If the conversation's channel is not available, default to the first available
          const firstAvailable = availableChannels[0] || 'web'
          setSelectedChannelState(firstAvailable)
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error getting conversation channel:", error)
        }
      }
    }

    getConversationChannel()

    // Cleanup function to cancel the request if conversation changes
    return () => {
      isCancelled = true
    }
  }, [conversationId, availableChannels])

  // Ensure selected channel is always available - only run once on initialization or when channels change significantly
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true
      return // Skip on first render to allow conversation channel to be loaded
    }

    if (!availableChannels.includes(selectedChannel)) {
      const firstAvailable = availableChannels[0] || 'web'
      setSelectedChannelState(firstAvailable)
    }
  }, [availableChannels, selectedChannel])

  return {
    selectedChannel,
    setSelectedChannel,
    availableChannels,
    isUpdatingChannel
  }
} 