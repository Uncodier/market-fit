"use client"

import React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { ChatMessage } from "@/app/types/chat"
import * as Icons from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"

interface MessageActionsProps {
  message: ChatMessage
  onEdit: (message: ChatMessage) => void
  onDelete: (message: ChatMessage) => Promise<void>
  onAccept: (message: ChatMessage) => Promise<void>
  onUndoAccept?: (message: ChatMessage) => void
  isDeleting?: boolean
  isAccepting?: boolean
  isActionsAccepted?: boolean
}

export function MessageActions({
  message,
  onEdit,
  onDelete,
  onAccept,
  onUndoAccept,
  isDeleting = false,
  isAccepting = false,
  isActionsAccepted = false
}: MessageActionsProps) {
  const { isDarkMode } = useTheme()
  
  const isAccepted = message.metadata?.status === "accepted" || isActionsAccepted
  const isPending = message.metadata?.status === "pending"

  // Only show actions for pending or accepted messages
  if (!isPending && !isAccepted) {
    return null
  }

  // If actions are accepted, show accepted state with options to revert, edit or delete
  if (isAccepted) {
    return (
      <div 
        className="rounded-full px-2 py-1.5 mt-2 inline-flex items-center gap-1.5"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(156, 163, 175, 0.15)' : 'rgba(156, 163, 175, 0.1)',
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEdit(message)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10"
                type="button"
                style={{
                  color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
                }}
              >
                <Icons.Pencil className="h-3.5 w-3.5" />
                <span className="text-xs">Edit</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit message</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUndoAccept && onUndoAccept(message)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10"
                type="button"
                style={{
                  color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
                }}
              >
                <Icons.RotateCcw className="h-3.5 w-3.5" />
                <span className="text-xs">Pending</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Return to pending status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDelete(message)}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
                style={{
                  color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
                }}
              >
                <Icons.Trash2 className="h-3.5 w-3.5" />
                <span className="text-xs">{isDeleting ? "Rejecting..." : "Reject"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reject message</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div 
      className="rounded-full px-2 py-1.5 mt-2 inline-flex items-center gap-1.5"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(156, 163, 175, 0.15)' : 'rgba(156, 163, 175, 0.1)',
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onEdit(message)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10"
              type="button"
              style={{
                color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
              }}
            >
              <Icons.Pencil className="h-3.5 w-3.5" />
              <span className="text-xs">Edit</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit message before sending</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onAccept(message)}
              disabled={isAccepting}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              style={{
                color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
              }}
            >
              <Icons.Check className="h-3.5 w-3.5" />
              <span className="text-xs">{isAccepting ? "Accepting..." : "Accept"}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Accept and send message</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onDelete(message)}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full transition-all hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              style={{
                color: isDarkMode ? 'rgba(156, 163, 175, 0.9)' : 'rgba(107, 114, 128, 0.9)'
              }}
            >
              <Icons.Trash2 className="h-3.5 w-3.5" />
              <span className="text-xs">{isDeleting ? "Rejecting..." : "Reject"}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reject message</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}


