"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight, PlusCircle } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/app/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"

interface ChatToggleProps {
  isCollapsed: boolean
  onToggle: () => void
  onNewConversation?: () => void
  onNewLeadConversation?: () => void
  onNewAgentConversation?: () => void
  onPrivateDiscussion?: () => void
  showNewConversationButton?: boolean
  /** Use in conversation toolbar (flex row); default overlay used absolute + full width when expanded */
  variant?: "toolbar" | "overlay"
  className?: string
  isLead?: boolean
  agentName?: string
  agentId?: string
  leadName?: string
  leadId?: string
}

export function ChatToggle({ 
  isCollapsed, 
  onToggle, 
  onNewConversation, 
  onNewLeadConversation,
  onNewAgentConversation,
  onPrivateDiscussion,
  showNewConversationButton = true,
  variant = "overlay",
  className,
  isLead = false,
  agentName = "Agent",
  agentId = "",
  leadName = "Visitor",
  leadId = ""
}: ChatToggleProps) {
  // Check if actions are available based on current state
  const canCreateAgentConversation = !!agentId;
  const canCreateLeadConversation = isLead && !!leadId;
  
  // Determine if any action is available
  const hasAvailableActions = canCreateAgentConversation || 
                             canCreateLeadConversation || 
                             onNewConversation;
  
  // Debug handlers
  const handleToggleClick = () => {
    console.log("Toggle button clicked");
    onToggle();
  };
  
  const handleNewLeadClick = () => {
    console.log("New lead conversation button clicked");
    if (onNewLeadConversation) {
      onNewLeadConversation();
    } else {
      console.error("onNewLeadConversation handler is not defined");
    }
  };
  
  const handleNewAgentClick = () => {
    console.log("New agent conversation button clicked");
    if (!agentId) {
      console.error("Cannot create agent conversation: No agent ID available");
      return;
    }
    
    if (onNewAgentConversation) {
      onNewAgentConversation();
    } else {
      console.error("onNewAgentConversation handler is not defined");
    }
  };
  
  const handlePrivateDiscussionClick = () => {
    console.log("Private discussion button clicked");
    if (!agentId) {
      console.error("Cannot create private discussion: No agent ID available");
      return;
    }
    
    if (onPrivateDiscussion) {
      onPrivateDiscussion();
    } else {
      console.error("onPrivateDiscussion handler is not defined");
    }
  };
  
  const handleNewConversationClick = () => {
    console.log("Generic new conversation button clicked");
    if (onNewConversation) {
      onNewConversation();
    } else {
      console.error("onNewConversation handler is not defined");
    }
  };

  const isToolbar = variant === "toolbar"

  return (
    <div
      className={cn(
        "z-[1000] flex items-center gap-2 h-[71px] max-h-[71px] min-h-[71px] px-2 sm:px-3 transition-all duration-300 ease-in-out shrink-0",
        isToolbar
          ? "relative w-auto"
          : cn(
              "absolute top-0 overflow-hidden",
              isCollapsed ? "w-[100px]" : "w-full"
            ),
        className
      )}
      style={isToolbar ? undefined : { transform: "translateZ(0)" }}
    >
      <div
        className={cn(
          "flex items-center gap-2 transition-transform duration-300 shrink-0",
          isToolbar ? "" : "w-full justify-between pr-4"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleClick}
          className="h-8 w-8 rounded-full font-inter font-bold bg-background transition-all duration-300 ease-in-out hover:bg-muted shrink-0"
          aria-label={isCollapsed ? "Show conversations" : "Hide conversations"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 transition-transform duration-200" />
          ) : (
            <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
          )}
        </Button>
      
      {showNewConversationButton && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!hasAvailableActions}>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full font-inter font-bold bg-background transition-all duration-300 ease-in-out shrink-0",
                hasAvailableActions ? "hover:bg-muted cursor-pointer" : "opacity-50 cursor-not-allowed"
              )}
              aria-label="New conversation options"
              disabled={!hasAvailableActions}
              title={!hasAvailableActions ? "No agent or lead selected" : "Create new conversation"}
            >
              <PlusCircle className="h-4 w-4 transition-transform duration-200" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 z-[1001]" sideOffset={8} forceMount>
              <DropdownMenuLabel className="text-xs text-muted-foreground py-2">Create new conversation</DropdownMenuLabel>
              
              {onNewLeadConversation && (
                <DropdownMenuItem 
                  onClick={handleNewLeadClick} 
                  className={cn(
                    "flex flex-col items-start py-3 hover:bg-muted/60 focus:bg-muted/60 data-[highlighted]:bg-muted/60 rounded-md",
                    canCreateLeadConversation ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}
                  disabled={!canCreateLeadConversation}
                >
                  <div className="flex items-center w-full gap-2 mb-1">
                    <div className="w-5 flex justify-center">
                      <Avatar className="h-5 w-5 bg-primary/10">
                        <AvatarImage src={isLead && leadId ? undefined : undefined} alt={leadName} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {leadName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="font-medium">New conversation with {isLead ? "lead" : "visitor"}</span>
                    {!canCreateLeadConversation && <span className="text-xs text-muted-foreground ml-2">(No lead selected)</span>}
                  </div>
                  <div className="pl-7 flex items-center gap-2 mt-1">
                    <Avatar className="h-5 w-5 mr-1 bg-primary/10">
                      <AvatarImage src={isLead && leadId ? undefined : undefined} alt={leadName} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {leadName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Continue with <span className="text-foreground">{leadName}</span>
                    </span>
                  </div>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator className="my-1" />
              
              {onNewAgentConversation && (
                <DropdownMenuItem 
                  onClick={handleNewAgentClick} 
                  className={cn(
                    "flex flex-col items-start py-3 hover:bg-muted/60 focus:bg-muted/60 data-[highlighted]:bg-muted/60 rounded-md",
                    canCreateAgentConversation ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}
                  disabled={!canCreateAgentConversation}
                >
                  <div className="flex items-center w-full gap-2 mb-1">
                    <div className="w-5 flex justify-center">
                      <Avatar className="h-5 w-5 bg-primary/10">
                        <AvatarImage src={agentId ? undefined : undefined} alt={agentName} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {agentName.length >= 2 
                            ? agentName.substring(0, 2).toUpperCase()
                            : agentName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="font-medium">New conversation with this agent</span>
                    {!canCreateAgentConversation && <span className="text-xs text-muted-foreground ml-2">(No agent selected)</span>}
                  </div>
                  <div className="pl-7 flex items-center gap-2 mt-1">
                    <Avatar className="h-5 w-5 mr-1 bg-primary/10">
                      <AvatarImage src={agentId ? undefined : undefined} alt={agentName} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {agentName.length >= 2 
                          ? agentName.substring(0, 2).toUpperCase()
                          : agentName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Start fresh with <span className="text-foreground">{agentName}</span>
                    </span>
                  </div>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator className="my-1" />
              
              {onPrivateDiscussion && (
                <DropdownMenuItem 
                  onClick={handlePrivateDiscussionClick} 
                  className={cn(
                    "flex flex-col items-start py-3 hover:bg-muted/60 focus:bg-muted/60 data-[highlighted]:bg-muted/60 rounded-md",
                    canCreateAgentConversation ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}
                  disabled={!canCreateAgentConversation}
                >
                  <div className="flex items-center w-full gap-2 mb-1">
                    <div className="w-5 flex justify-center">
                      <Avatar className="h-5 w-5 bg-primary/10">
                        <AvatarImage src={agentId ? undefined : undefined} alt={agentName} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {agentName.length >= 2 
                            ? agentName.substring(0, 2).toUpperCase()
                            : agentName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="font-medium">Privately discuss with agent</span>
                    {!canCreateAgentConversation && <span className="text-xs text-muted-foreground ml-2">(No agent selected)</span>}
                  </div>
                  <div className="pl-7 flex items-center gap-2 mt-1">
                    <Avatar className="h-5 w-5 mr-1 bg-primary/10">
                      <AvatarImage src={agentId ? undefined : undefined} alt={agentName} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {agentName.length >= 2 
                          ? agentName.substring(0, 2).toUpperCase()
                          : agentName.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      Private chat with <span className="text-foreground">{agentName}</span>
                    </span>
                  </div>
                </DropdownMenuItem>
              )}
              
            {onNewConversation && !onNewLeadConversation && !onNewAgentConversation && !onPrivateDiscussion && (
              <DropdownMenuItem 
                onClick={handleNewConversationClick} 
                className="cursor-pointer flex items-center hover:bg-muted/60 focus:bg-muted/60 data-[highlighted]:bg-muted/60 rounded-md py-2"
              >
                <div className="w-5 flex justify-center">
                  <Avatar className="h-5 w-5 bg-primary/10">
                    <AvatarImage src={undefined} alt="User" />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      U
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="ml-2">New conversation</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </div>
  )
} 