"use client"

import React from "react"
import { HelpCircle } from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface HelpButtonProps {
  className?: string
  size?: "sm" | "md" | "lg"
  tooltipText?: string
  welcomeMessage?: string
  task?: string
}

export function HelpButton({ 
  className, 
  size = "md",
  tooltipText = "Show help chat",
  welcomeMessage,
  task
}: HelpButtonProps) {
  const handleHelpClick = () => {
    console.log('Help button clicked')
    if (typeof window !== 'undefined') {
      console.log('Window MarketFit:', (window as any).MarketFit)
      if ((window as any).MarketFit?.openChatWithTask) {
        console.log('Calling openChatWithTask')
        if (welcomeMessage || task) {
          ;(window as any).MarketFit.openChatWithTask({
            welcomeMessage: welcomeMessage || "Hi! How can I help you today?",
            task: task,
            clearExistingMessages: false,
            newConversation: false
          })
        } else {
          ;(window as any).MarketFit.openChatWithTask({
            welcomeMessage: "Hi! How can I help you today?",
            clearExistingMessages: false,
            newConversation: false
          })
        }
      } else {
        console.log('MarketFit.openChatWithTask not available')
      }
    }
  }

  const sizeClasses = {
    sm: "h-8 w-8 p-0",
    md: "h-9 w-9 p-0", 
    lg: "h-10 w-10 p-0"
  }

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className={cn(sizeClasses[size], "hover:scale-105 transition-all duration-200 active:scale-95", className)}
            onClick={handleHelpClick}
          >
            <HelpCircle className={iconSizes[size]} />
            <span className="sr-only">Help</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}