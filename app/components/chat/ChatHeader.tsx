"use client"

import React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Agent } from "@/app/types/agents"
import { cn } from "@/lib/utils"
import { ChatToggle } from "@/app/components/chat/chat-toggle"
import { truncateAgentName, truncateLeadName } from "@/app/utils/name-utils"

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
  conversationId
}: ChatHeaderProps) {
  // Helper function to get the icon component dynamically
  const getIconComponent = (iconName: string) => {
    // This is imported from the parent component
    const Icons = require("@/app/components/ui/icons")
    return Icons[iconName] || Icons.User
  }

  // Helper function to determine the best icon based on agent role or type
  const getIconByRoleOrType = () => {
    if (currentAgent?.icon) {
      // Si el agente ya tiene un icono definido, usarlo
      return getIconComponent(currentAgent.icon)
    }
    
    // Determinar según el rol o tipo
    let iconName = "User" // Default icon
    
    if (currentAgent?.role) {
      // Mapear roles comunes a iconos apropiados
      const roleLower = currentAgent.role.toLowerCase()
      
      if (roleLower.includes("growth") && roleLower.includes("lead")) {
        iconName = "BarChart"
      } else if (roleLower.includes("growth") && roleLower.includes("market")) {
        iconName = "TrendingUp"
      } else if (roleLower.includes("data") && roleLower.includes("analyst")) {
        iconName = "PieChart"
      } else if (roleLower.includes("ux") || roleLower.includes("designer")) {
        iconName = "Smartphone"
      } else if (roleLower.includes("sales") || roleLower.includes("crm")) {
        iconName = "ShoppingCart"
      } else if (roleLower.includes("support") || roleLower.includes("customer")) {
        iconName = "HelpCircle"
      } else if (roleLower.includes("content") || roleLower.includes("copywriter")) {
        iconName = "FileText"
      }
    } else if (currentAgent?.type) {
      // Si no hay rol, usar el tipo
      switch (currentAgent.type.toLowerCase()) {
        case "marketing":
          iconName = "TrendingUp"
          break
        case "sales":
          iconName = "ShoppingCart"
          break
        case "support":
          iconName = "HelpCircle"
          break
        case "product":
          iconName = "Smartphone"
          break
      }
    }
    
    return getIconComponent(iconName)
  }

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

  // Get the appropriate icon component
  const IconComponent = getIconByRoleOrType()
  
  // Determine if we should show assignee instead of agent
  const hasAssignee = !!(isLead && leadData?.assignee)
  
  // Determine what to display on the left side (agent or assignee)
  const leftSideDisplayName = hasAssignee 
    ? truncateAgentName(leadData.assignee.name)
    : truncateAgentName(currentAgent?.name || agentName || "Agent")
  
  const leftSideAvatar = hasAssignee 
    ? leadData.assignee.avatar_url 
    : `/avatars/agent-${agentId}.png`
  
  const leftSideAvatarFallback = hasAssignee
    ? leadData.assignee.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)
    : (IconComponent ? null : leftSideDisplayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2))
  
  // Check if a conversation is selected
  const hasSelectedConversation = conversationId && conversationId !== "" && !conversationId.startsWith("new-");

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
        "max-w-[calc(100%-240px)] mx-auto w-full flex items-center justify-between transition-all duration-300 ease-in-out"
      )}>
        {/* Agent/Assignee info - only shown when a conversation is selected */}
        {hasSelectedConversation && (
          <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out">
            <Avatar className={cn(
              "h-12 w-12 border-2 transition-transform duration-300 ease-in-out",
              hasAssignee ? "border-blue-500/20" : "border-primary/10"
            )}>
              <AvatarImage src={leftSideAvatar} alt={leftSideDisplayName} />
              <AvatarFallback className={cn(
                hasAssignee ? "bg-blue-500/10 text-blue-600" : "bg-primary/10"
              )}>
                {hasAssignee ? (
                  leftSideAvatarFallback
                ) : IconComponent ? (
                  <IconComponent className="h-6 w-6 transition-transform duration-200" aria-hidden={true} />
                ) : (
                  leftSideAvatarFallback
                )}
              </AvatarFallback>
            </Avatar>
            <div className="transition-transform duration-300 ease-in-out">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-lg">{leftSideDisplayName}</h2>
                {hasAssignee && (
                  <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-blue-500/10 text-blue-600 border-blue-500/20">
                    Assigned
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Visitor/Lead info - only shown when not loading, not agent-only conversation, and a conversation is selected */}
        {!isLoadingLead && !isAgentOnlyConversation && hasSelectedConversation && (
          <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out">
            <div className="transition-transform duration-300 ease-in-out text-right">
              <div className="flex items-center gap-2 justify-end">
                {isLead ? (
                  <Link 
                    href={`/leads/${leadData.id}`} 
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <h2 className="font-medium text-lg">{truncateLeadName(leadData.name)}</h2>
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-amber-500/10 text-amber-600 border-amber-500/20">
                      {leadData.company?.name 
                        ? (leadData.company.name.length > 20 
                           ? leadData.company.name.substring(0, 20) + "..." 
                           : leadData.company.name)
                        : leadData.type}
                    </Badge>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-lg">Visitor</h2>
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                      Visitor
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            {isLead ? (
              <Link href={`/leads/${leadData.id}`} className="hover:opacity-80 transition-opacity">
                <Avatar className="h-12 w-12 border-2 border-amber-500/20 transition-transform duration-300 ease-in-out">
                  <AvatarImage src={leadData.avatarUrl} alt={leadData.name} />
                  <AvatarFallback className="bg-amber-500/10 text-amber-600">
                    {leadData.name.split(' ').map((name: string) => name[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className="h-12 w-12 border-2 border-primary/10 transition-transform duration-300 ease-in-out">
                <AvatarImage src="/avatars/visitor-default.png" alt="Visitor" />
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