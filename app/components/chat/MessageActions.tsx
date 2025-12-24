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
        className="rounded-lg px-3 py-2 mt-2 inline-flex items-center gap-2"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
          border: '1px solid',
          borderColor: 'rgba(34, 197, 94, 0.3)',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEdit(message)}
                className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 rounded px-2 py-1 transition-colors"
                type="button"
              >
                <Icons.Pencil className="h-3 w-3 mr-1" />
                Edit
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit message</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border opacity-30" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUndoAccept && onUndoAccept(message)}
                className="inline-flex items-center text-xs text-amber-500 hover:text-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 rounded px-2 py-1 transition-colors"
                type="button"
              >
                <Icons.RotateCcw className="h-3 w-3 mr-1" />
                Pending
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Return to pending status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="h-4 w-px bg-border opacity-30" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDelete(message)}
                disabled={isDeleting}
                className="inline-flex items-center text-xs text-red-500 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <Icons.Trash2 className="h-3 w-3 mr-1" />
                {isDeleting ? "Rejecting..." : "Reject"}
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
      className="rounded-lg px-3 py-2 mt-2 inline-flex items-center gap-2"
      style={{ 
        backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
        border: '1px solid',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onEdit(message)}
              className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-2 py-1 transition-colors"
              type="button"
            >
              <Icons.Pencil className="h-3 w-3 mr-1" />
              Edit
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Edit message before sending</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-4 w-px bg-border opacity-30" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onAccept(message)}
              disabled={isAccepting}
              className="inline-flex items-center text-xs text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <Icons.Check className="h-3 w-3 mr-1" />
              {isAccepting ? "Accepting..." : "Accept"}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Accept and send message</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-4 w-px bg-border opacity-30" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onDelete(message)}
              disabled={isDeleting}
              className="inline-flex items-center text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <Icons.Trash2 className="h-3 w-3 mr-1" />
              {isDeleting ? "Rejecting..." : "Reject"}
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


