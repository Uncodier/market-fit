import { useState, useEffect, useMemo, useCallback } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getEnabledSiteChannels, leadHasChannel, normalizeChannel } from "@/lib/site-channels"

type Channel = 'web' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'telegram' | 'voice' | 'website_chat' | string


interface UseChannelSelectorProps {
  conversationId?: string
  leadData?: {
    id: string
    email?: string
    phone?: string
    social_networks?: any
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

  // Debug log para tracking
  console.log(`[useChannelSelector] Hook called - conversationId: ${conversationId}, selectedChannel: ${selectedChannel}`)

  // Memoize available channels calculation
  const availableChannels = useMemo(() => {
    const channels: Channel[] = ['web'] // Web chat is always available

    console.log(`[availableChannels] Calculating channels - selectedChannel: ${selectedChannel}, isAgentOnly: ${isAgentOnlyConversation}`)

    // Don't show other channels for agent-only conversations
    if (isAgentOnlyConversation) {
      console.log(`[availableChannels] Agent-only conversation, only web available`)
      // Always include the selected channel even for agent-only conversations
      if (selectedChannel !== 'web' && !channels.includes(selectedChannel)) {
        channels.push(selectedChannel)
        console.log(`[availableChannels] Added conversation channel ${selectedChannel} to agent-only conversation`)
      }
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

    // IMPORTANT: Always include the conversation's selected channel if it's not already included
    // This ensures the conversation's original channel is always available for selection
    const normalizedSelected = normalizeChannel(selectedChannel) as Channel
    if (normalizedSelected && !channels.includes(normalizedSelected)) {
      channels.push(normalizedSelected)
      console.log(`[availableChannels] Added conversation's channel ${normalizedSelected} to available channels`)
    }

    console.log(`[availableChannels] Final channels:`, channels)
    return channels
  }, [currentSite, leadData, isAgentOnlyConversation, selectedChannel])

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
        if (isCancelled || error) {
          if (error) console.error("Error fetching conversation channel:", error)
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
        if (conversationChannel === 'website_chat' as any) {
          conversationChannel = 'web'
          console.log(`[getConversationChannel] Normalized website_chat to web`)
        } else if (conversationChannel === 'twitter' as any) {
          conversationChannel = 'x'
          console.log(`[getConversationChannel] Normalized twitter to x`)
        }
        
        console.log(`📺 Channel loaded from conversation ${conversationId}: ${conversationChannel}`)
        
        // Set the channel from database
        setSelectedChannelState(conversationChannel)
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
  }, [conversationId])

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
    isUpdatingChannel
  }
} 