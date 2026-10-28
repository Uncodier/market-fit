"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { createConversation } from "@/app/services/chat-service"
import { toast } from "react-hot-toast"

export function useNewCustomerSupportConversation() {
  const router = useRouter()
  const { user } = useAuthContext()
  const { currentSite } = useSite()
  const creating = useRef(false)
  const [isCreating, setIsCreating] = useState(false)

  const startConversation = async () => {
    if (creating.current) return
    if (!user?.id || !currentSite?.id) {
      toast.error("Select a site and sign in to create a conversation.")
      return
    }

    creating.current = true
    setIsCreating(true)
    try {
      const { data: agent, error } = await createClient()
        .from("agents")
        .select("id, name")
        .eq("site_id", currentSite.id)
        .eq("role", "Customer Support")
        .single()

      if (error || !agent) {
        toast.error("Customer Support agent not found for this site.")
        return
      }

      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agent.id,
        `Direct chat with ${agent.name}`,
        { is_agent_conversation: true }
      )
      if (!conversation) {
        toast.error("Failed to create conversation. Please try again.")
        return
      }

      const params = new URLSearchParams({
        agentId: agent.id,
        agentName: agent.name,
        conversationId: conversation.id,
      })
      router.push(`/chat?${params}`)
    } catch {
      toast.error("Failed to create conversation. Please try again.")
    } finally {
      creating.current = false
      setIsCreating(false)
    }
  }

  return { startConversation, isCreating }
}