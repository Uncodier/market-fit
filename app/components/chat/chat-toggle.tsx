"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight, PlusCircle } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

interface ChatToggleProps {
  isCollapsed: boolean
  onToggle: () => void
  onNewConversation?: () => void
  showNewConversationButton?: boolean
  className?: string
}

export function ChatToggle({ 
  isCollapsed, 
  onToggle, 
  onNewConversation, 
  showNewConversationButton = true,
  className 
}: ChatToggleProps) {
  return (
    <div className={cn(
      "absolute top-0 z-20 flex items-center gap-2 h-[71px] px-4 transition-all duration-300 ease-in-out",
      isCollapsed ? "left-0" : "left-0",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="h-8 w-8 rounded-full bg-background transition-all duration-300 ease-in-out hover:bg-muted"
        aria-label={isCollapsed ? "Show conversations" : "Hide conversations"}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
        ) : (
          <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
        )}
      </Button>
      
      {showNewConversationButton && onNewConversation && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewConversation}
          className="h-8 w-8 rounded-full bg-background transition-all duration-300 ease-in-out hover:bg-muted"
          aria-label="New conversation"
        >
          <PlusCircle className="h-4 w-4 transition-transform duration-200" />
        </Button>
      )}
    </div>
  )
} 