"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Mail } from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { cn } from "@/lib/utils"
import { ConversationListItem } from "@/app/types/chat"
import { useTheme } from "@/app/context/ThemeContext"
import * as Icons from "@/app/components/ui/icons"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator 
} from "@/app/components/ui/dropdown-menu"
import { formatDistanceToNow, format } from "date-fns"
import { truncateConversationNames } from "@/app/utils/name-utils"

interface ConversationItemProps {
  conversation: ConversationListItem
  isSelected: boolean
  onSelect: () => void
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
}

// Utility functions
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + "..."
}

function getDefaultMessage(title: string): string {
  if (title.startsWith("Chat with")) {
    return "Conversation started"
  }
  return "New conversation"
}

function formatMessageDate(timestamp: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - timestamp.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) {
    return "now"
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}m`
  } else if (diffInHours < 24) {
    return `${diffInHours}h`
  } else if (diffInDays < 7) {
    return `${diffInDays}d`
  } else {
    return format(timestamp, "MMM d")
  }
}

// Function to get channel icon
function getChannelIcon(channel: 'web' | 'email' | 'whatsapp' | undefined, isAgentConversation?: boolean) {
  // Si es una conversación de agente (team member <-> agent), mostrar ícono de IA
  if (isAgentConversation) {
    return <Icons.User size={15} className="text-muted-foreground/60" />;
  }
  
  const iconChannel = channel || 'web'; // Default to web if not specified
  
  switch (iconChannel) {
    case 'whatsapp':
      return <WhatsAppIcon size={15} className="text-muted-foreground/60" />;
    case 'email':
      return <Mail className="text-muted-foreground/60" style={{ width: '15px', height: '15px' }} />;
    case 'web':
    default:
      return <Icons.Globe className="text-blue-500/70" style={{ width: '15px', height: '15px' }} />;
  }
}

export function ConversationItem({ 
  conversation, 
  isSelected, 
  onSelect, 
  onRename, 
  onArchive, 
  onDelete 
}: ConversationItemProps) {
  const { isDarkMode } = useTheme()

  return (
    <div
      className={cn(
        "w-full text-left py-3 px-4 rounded-none transition-colors border-b border-border/30",
        "hover:bg-accent/20 group",
        isSelected && isDarkMode 
          ? "bg-primary/15" 
          : isSelected && "bg-primary/10"
      )}
      style={{ 
        width: '320px', 
        maxWidth: '320px', 
        boxSizing: 'border-box',
        position: 'relative',
        cursor: 'pointer'
      }}
      onClick={onSelect}
    >
      <div
        className="w-full text-left"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'block'
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 max-w-[90%]">
            {conversation.status === 'pending' && (
              <div className="flex-shrink-0 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
            <span className={cn(
              "font-medium text-sm truncate",
              isSelected && "text-primary"
            )}>
              {truncateText(conversation.title || "Untitled Conversation", 35)}
            </span>
          </div>
        </div>
        <div className={cn(
          "text-xs truncate",
          isSelected ? "text-muted-foreground" : "text-muted-foreground/80"
        )}>
          {truncateText(conversation.lastMessage || getDefaultMessage(conversation.title || ""), 50)}
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <div className={cn(
            "text-[11px] flex items-center gap-1 truncate",
            isSelected ? "text-primary/70" : "text-muted-foreground/70"
          )}>
            {getChannelIcon(conversation.channel, !conversation.leadName && !!conversation.agentId)}
            <span className="truncate">{truncateText(conversation.agentName || "No Agent Name", 15)}</span>
            {!conversation.agentName && <span className="text-red-500 flex-shrink-0">!</span>}
            {conversation.leadName && <span className="flex-shrink-0"> · </span>}
            {conversation.leadName && <span className="truncate">{truncateText(conversation.leadName, 15)}</span>}
          </div>
          <span className={cn(
            "text-[11px] whitespace-nowrap flex-shrink-0",
            isSelected ? "text-primary/70" : "text-muted-foreground/70"
          )}>
            {conversation.timestamp ? formatMessageDate(conversation.timestamp) : ""}
          </span>
        </div>
      </div>
      
      {/* Dropdown Menu */}
      <div 
        className="absolute right-2 top-2 transition-opacity duration-150 ease-in-out opacity-0 group-hover:opacity-100 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-7 w-7 p-0" aria-label="More options">
              <Icons.MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={onRename}
              className="cursor-pointer"
            >
              <Icons.Pencil className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onArchive}
              className="cursor-pointer"
            >
              <Icons.Archive className="mr-2 h-4 w-4" />
              <span>Archive</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <Icons.Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
} 