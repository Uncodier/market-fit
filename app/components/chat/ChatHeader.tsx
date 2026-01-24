"use client"

import React, { useState } from "react"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/app/components/ui/select"
import { Agent } from "@/app/types/agents"
import { cn } from "@/lib/utils"
import { ChatToggle } from "@/app/components/chat/chat-toggle"
import { truncateAgentName, truncateLeadName } from "@/app/utils/name-utils"
import { STATUS_STYLES, LEAD_STATUSES } from "@/app/leads/types"
import { updateLead } from "@/app/leads/actions"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"

interface ChatHeaderProps {
  agentId: string
  agentName: string
  currentAgent: Agent | null
  isAgentOnlyConversation: boolean
  isLoadingLead: boolean
  leadData: any
  isLead: boolean
  isChatListCollapsed: boolean
  toggleChatList: () => void
  startNewConversation: () => void
  handleNewLeadConversation: () => void
  handleNewAgentConversation: () => void
  handlePrivateDiscussion: () => void
  conversationId?: string
  onLeadStatusUpdate?: () => void
}

export function ChatHeader({
  agentId,
  agentName,
  currentAgent,
  isAgentOnlyConversation,
  isLoadingLead,
  leadData,
  isLead,
  isChatListCollapsed,
  toggleChatList,
  startNewConversation,
  handleNewLeadConversation,
  handleNewAgentConversation,
  handlePrivateDiscussion,
  conversationId,
  onLeadStatusUpdate
}: ChatHeaderProps) {
  const { currentSite } = useSite()
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  
  // Get the agent type with proper capitalization
  const agentType = currentAgent?.type 
    ? currentAgent.type.charAt(0).toUpperCase() + currentAgent.type.slice(1) 
    : "Agent"
    
  // Get the agent role with proper formatting (prioritize role over type)
  const agentRole = currentAgent?.role 
    ? currentAgent.role
        .replace(/_/g, ' ')  // Replace underscores with spaces
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    : agentType
  
  // Determine if we should show assignee instead of agent
  const hasAssignee = !!(isLead && leadData?.assignee)
  
  // Determine what to display on the left side (agent or assignee)
  const leftSideDisplayName = hasAssignee 
    ? truncateAgentName(leadData.assignee.name)
    : truncateAgentName(currentAgent?.name || agentName || "Agent")
  
  const leftSideAvatar = hasAssignee 
    ? leadData.assignee.avatar_url 
    : undefined
  
  const leftSideAvatarFallback = hasAssignee
    ? leadData.assignee.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)
    : leftSideDisplayName.length >= 2 
      ? leftSideDisplayName.substring(0, 2).toUpperCase()
      : leftSideDisplayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)
  
  // Check if a conversation is selected
  const hasSelectedConversation = conversationId && conversationId !== "" && !conversationId.startsWith("new-");

  // Handle status change
  const handleStatusChange = async (newStatus: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => {
    if (!isLead || !leadData?.id || isUpdatingStatus) return
    
    setIsUpdatingStatus(true)
    try {
      const result = await updateLead({
        id: leadData.id,
        site_id: leadData.site_id || currentSite?.id || "",
        status: newStatus
      })
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Lead status updated successfully")
        
        // Update local leadData immediately for instant UI feedback
        if (leadData) {
          leadData.status = newStatus
        }
        
        // Trigger refresh of lead data
        if (onLeadStatusUpdate) {
          onLeadStatusUpdate()
        }
        
        // Emit event to update conversation list
        window.dispatchEvent(new CustomEvent('lead:status-updated', {
          detail: { 
            leadId: leadData.id,
            newStatus,
            conversationId
          }
        }))
      }
    } catch (error) {
      console.error("Error updating lead status:", error)
      toast.error("Failed to update lead status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Get status display name
  const getStatusDisplayName = (status: string) => {
    const statusObj = LEAD_STATUSES.find(s => s.id === status)
    return statusObj ? statusObj.name : status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Get current lead status
  const currentStatus = leadData?.status || "new"

  return (
    <div className="border-b flex-none h-[71px] flex items-center fixed w-[-webkit-fill-available] z-[999] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80" 
      style={{ backdropFilter: 'blur(10px)' }}>
      {/* ChatToggle positioned absolutely */}
      <ChatToggle 
        isCollapsed={isChatListCollapsed} 
        onToggle={toggleChatList}
        onNewConversation={startNewConversation}
        onNewLeadConversation={handleNewLeadConversation}
        onNewAgentConversation={handleNewAgentConversation}
        onPrivateDiscussion={handlePrivateDiscussion}
        showNewConversationButton={true}
        isLead={isLead}
        agentName={leftSideDisplayName}
        agentId={agentId}
        leadName={isLead ? truncateLeadName(leadData?.name || "Lead") : "Visitor"}
        leadId={isLead ? leadData?.id || "" : ""}
        className="absolute top-0 left-0"
      />
      
      <div className={cn(
        "max-w-[calc(100%-240px)] mx-auto w-full flex items-center justify-between transition-all duration-300 ease-in-out gap-4"
      )}>
        {/* Agent/Assignee info - only shown when a conversation is selected */}
        {hasSelectedConversation && (
          <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out min-w-0 flex-1">
            <Avatar className={cn(
              "h-12 w-12 border-2 transition-transform duration-300 ease-in-out flex-shrink-0",
              hasAssignee ? "border-blue-500/20" : "border-primary/10"
            )}>
              <AvatarImage src={leftSideAvatar} alt={leftSideDisplayName} />
              <AvatarFallback className={cn(
                hasAssignee ? "bg-blue-500/10 text-blue-600" : "bg-primary/10"
              )}>
                {leftSideAvatarFallback}
              </AvatarFallback>
            </Avatar>
            <div className="transition-transform duration-300 ease-in-out min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                {!hasAssignee && (
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-primary/10 text-primary border-primary/20 flex-shrink-0">
                    Agent
                  </Badge>
                )}
                <h2 className="font-medium text-lg truncate">{leftSideDisplayName}</h2>
                {hasAssignee && (
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-blue-500/10 text-blue-600 border-blue-500/20 flex-shrink-0">
                    Assigned
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Visitor/Lead info - only shown when not loading, not agent-only conversation, and a conversation is selected */}
        {!isLoadingLead && !isAgentOnlyConversation && hasSelectedConversation && (
          <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out min-w-0 flex-1 justify-end">
            <div className="transition-transform duration-300 ease-in-out text-right min-w-0 flex-1">
              <div className="flex items-center gap-2 justify-end min-w-0">
                {isLead ? (
                  <NavigationLink 
                    href={`/leads/${leadData.id}?name=${encodeURIComponent(leadData.name)}`} 
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer min-w-0 flex-1 justify-end"
                  >
                    <h2 className="font-medium text-lg truncate">{truncateLeadName(leadData.name)}</h2>
                    <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                      <Select
                        value={currentStatus}
                        onValueChange={handleStatusChange}
                        disabled={isUpdatingStatus}
                      >
                        <SelectTrigger hideIcon className="h-auto text-xs border-none p-0 shadow-none hover:bg-transparent focus:ring-0 max-w-[200px] flex-shrink-0">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs px-2 py-0 h-5 transition-colors duration-300 flex-shrink-0 truncate max-w-[200px] cursor-pointer",
                              STATUS_STYLES[currentStatus] || "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}
                          >
                            {getStatusDisplayName(currentStatus)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </NavigationLink>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-medium text-lg truncate">Visitor</h2>
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 flex-shrink-0">
                      Visitor
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            {isLead ? (
              <NavigationLink 
                href={`/leads/${leadData.id}?name=${encodeURIComponent(leadData.name)}`} 
                className="hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <Avatar className="h-12 w-12 border-2 border-amber-500/20 transition-transform duration-300 ease-in-out">
                  <AvatarImage src={leadData.avatarUrl} alt={leadData.name} />
                  <AvatarFallback className="bg-amber-500/10 text-amber-600">
                    {leadData.name.split(' ').map((name: string) => name[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </NavigationLink>
            ) : (
              <Avatar className="h-12 w-12 border-2 border-primary/10 transition-transform duration-300 ease-in-out flex-shrink-0">
                <AvatarImage src={undefined} alt="Visitor" />
                <AvatarFallback className="bg-primary/10">
                  V
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 