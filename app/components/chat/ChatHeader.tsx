"use client"

import React from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Agent } from "@/app/types/agents"
import { cn } from "@/lib/utils"
import { ChatToggle } from "@/app/components/chat/chat-toggle"

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
  
  // Determine final agent name to display (preferring currentAgent.name over prop)
  const displayAgentName = currentAgent?.name || agentName || "Agent";
  
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
        agentName={displayAgentName}
        agentId={agentId}
        leadName={isLead ? leadData?.name || "Lead" : "Visitor"}
        leadId={isLead ? leadData?.id || "" : ""}
        className="absolute top-0 left-0"
      />
      
      <div className={cn(
        "max-w-[calc(100%-240px)] mx-auto w-full flex items-center justify-between transition-all duration-300 ease-in-out"
      )}>
        {/* Agent info - only shown when a conversation is selected */}
        {hasSelectedConversation && (
          <div className="flex items-center gap-3 transition-opacity duration-300 ease-in-out">
            <Avatar className="h-12 w-12 border-2 border-primary/10 transition-transform duration-300 ease-in-out">
              <AvatarImage src={`/avatars/agent-${agentId}.png`} alt={displayAgentName} />
              <AvatarFallback className="bg-primary/10">
                {IconComponent ? (
                  <IconComponent className="h-6 w-6 transition-transform duration-200" aria-hidden={true} />
                ) : (
                  displayAgentName.charAt(0)
                )}
              </AvatarFallback>
            </Avatar>
            <div className="transition-transform duration-300 ease-in-out">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-lg">{displayAgentName}</h2>
                <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                  {agentRole}
                </Badge>
                <span className="text-xs text-muted-foreground transition-colors duration-300">
                  {(() => {
                    // Determinar el color según el estado
                    let statusColor = "bg-amber-500"; // Default color
                    let statusText = "Offline";
                    
                    if (currentAgent?.status) {
                      statusText = currentAgent.status.charAt(0).toUpperCase() + currentAgent.status.slice(1);
                      
                      switch(currentAgent.status) {
                        case 'active':
                          statusColor = "bg-green-500";
                          statusText = "Online";
                          break;
                        case 'learning':
                          statusColor = "bg-blue-500";
                          break;
                        case 'error':
                          statusColor = "bg-red-500";
                          break;
                        case 'inactive':
                          statusColor = "bg-amber-500";
                          break;
                      }
                    }
                    
                    return (
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColor} transition-colors duration-300`}></span> 
                        {statusText}
                      </span>
                    );
                  })()}
                </span>
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
                    <h2 className="font-medium text-lg">{leadData.name}</h2>
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300 bg-amber-500/10 text-amber-600 border-amber-500/20">
                      {leadData.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground transition-colors duration-300">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-colors duration-300"></span> {leadData.status}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-lg">Visitor</h2>
                    <Badge variant="outline" className="text-xs px-2 py-0 h-5 transition-colors duration-300">
                      Visitor
                    </Badge>
                    <span className="text-xs text-muted-foreground transition-colors duration-300">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 transition-colors duration-300"></span> Online
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            {isLead ? (
              <Link href={`/leads/${leadData.id}`} className="hover:opacity-80 transition-opacity">
                <Avatar className="h-12 w-12 border-2 border-amber-500/20 transition-transform duration-300 ease-in-out">
                  <AvatarImage src={leadData.avatarUrl} alt={leadData.name} />
                  <AvatarFallback className="bg-amber-500/10 text-amber-600">
                    {leadData.name.split(' ').map((name: string) => name[0]).join('')}
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