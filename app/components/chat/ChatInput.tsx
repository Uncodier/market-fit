"use client"

import React, { FormEvent, useCallback, useRef, useMemo, memo, useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { OptimizedTextarea } from "@/app/components/ui/optimized-textarea"
import * as Icons from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { cn } from "@/lib/utils"
import { useLayout } from "@/app/context/LayoutContext"
import { ChannelSelector } from "./ChannelSelector"
import { useChannelSelector } from "@/app/hooks/useChannelSelector"
// Removed dynamic width calc; align with messages container

interface ChatInputProps {
  message?: string // Optional for uncontrolled mode
  setMessage: (message: string) => void
  handleMessageChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>
  isLoading: boolean
  handleSendMessage: (e: FormEvent) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
  conversationId?: string
  isChatListCollapsed?: boolean
  leadData?: {
    id: string
    email?: string
    phone?: string
  } | null
  isAgentOnlyConversation?: boolean
}

// Memoize the ChatInput component to prevent unnecessary re-renders
export const ChatInput = memo(function ChatInput({
  message,
  setMessage,
  handleMessageChange,
  textareaRef: externalRef,
  isLoading,
  handleSendMessage,
  handleKeyDown,
  conversationId,
  isChatListCollapsed = false,
  leadData,
  isAgentOnlyConversation = false
}: ChatInputProps) {
  const { isLayoutCollapsed } = useLayout()
  const internalRef = useRef<HTMLTextAreaElement>(null)
  // Dynamic width calculation removed; rely on static container matching messages
  
  // Track whether the textarea has any user input to control send button fill/enable
  const [hasInput, setHasInput] = useState(false)

  // Channel selector hook - now optimized
  const {
    selectedChannel,
    setSelectedChannel,
    availableChannels,
    isUpdatingChannel
  } = useChannelSelector({
    conversationId,
    leadData,
    isAgentOnlyConversation
  })
  
  // CRITICAL: Direct handler to prevent character loss
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Always use the direct message change handler if available
    if (handleMessageChange) {
      handleMessageChange(e)
    } else {
      // Fallback to direct state update
      setMessage(e.target.value)
    }
    // Update input presence state for send button behavior
    setHasInput(e.target.value.trim().length > 0)
  }, [handleMessageChange, setMessage])
  
  // Optimized keyboard handler
  const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab normally for accessibility
    if (e.key === 'Tab') {
      return
    }
    
    // Delegate complex logic to parent
    handleKeyDown(e)
  }, [handleKeyDown])
  
  // Memoize form submit handler
  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    handleSendMessage(e)
  }, [handleSendMessage])
  
  // Memoize conversation validation
  const hasSelectedConversation = useMemo(() => {
    return conversationId && conversationId !== "" && !conversationId.startsWith("new-")
  }, [conversationId])
  
  // Initialize hasInput when a controlled message value is provided
  useEffect(() => {
    if (typeof message === 'string') {
      setHasInput(message.trim().length > 0)
    }
  }, [message])

  // Send button is enabled and filled only when there is input and not loading
  const canSend = useMemo(() => {
    return hasInput && !isLoading
  }, [hasInput, isLoading])
  
  // If no conversation is selected, don't render the input
  if (!hasSelectedConversation) {
    return null
  }
  
  return (
    <div 
      className={cn(
        "sticky bottom-0 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10 mb-[20px]"
      )}
      style={{ bottom: '20px' }}
    >
      <div>
        <div className="max-w-[calc(100%-240px)] mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <OptimizedTextarea
                ref={externalRef ?? internalRef}
                onChange={handleChange}
                onKeyDown={handleKeyDownInternal}
                placeholder="Message..."
                className="resize-none min-h-[135px] w-full py-5 pl-9 pr-[60px] rounded-2xl border border-input bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
                disabled={isLoading}
                style={{
                  lineHeight: '1.5',
                  overflowY: 'hidden',
                  wordWrap: 'break-word',
                  paddingBottom: '50px',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  height: '135px',
                  opacity: isLoading ? 1 : undefined
                }}
              />

              {/* Send button on the right - moved after textarea */}
              <div className="absolute bottom-[15px] right-[15px]" style={{ zIndex: 51 }}>
                <Button 
                  type="submit" 
                  size="icon"
                  variant="ghost"
                  disabled={!canSend}
                  className={cn(
                    "rounded-[9999px] h-[39px] w-[39px] transition-all duration-200",
                    canSend
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-sm hover:shadow-lg hover:shadow-primary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background opacity-100"
                      : "text-muted-foreground opacity-50 hover:bg-transparent"
                  )}
                >
                  {isLoading ? (
                    <LoadingSkeleton size="sm" />
                  ) : (
                    <Icons.ChevronRight className="h-5 w-5" />
                  )}
                  <span className="sr-only">Send</span>
                </Button>
              </div>
              
              {/* Channel selector centered */}
              <div className="absolute bottom-[15px] left-1/2 -translate-x-1/2 w-fit flex items-center justify-center" style={{ zIndex: 52 }}>
                <ChannelSelector
                  selectedChannel={selectedChannel}
                  onChannelChange={setSelectedChannel}
                  availableChannels={availableChannels}
                  isUpdating={isUpdatingChannel}
                />
              </div>
              
              {/* Action buttons on the left (currently hidden) */}
              <div className="absolute bottom-[15px] left-[15px] flex space-x-1 hidden">
                <Button 
                  type="button" 
                  size="icon"
                  variant="ghost"
                  className="rounded-xl h-[39px] w-[39px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                  title="Attach file"
                >
                  <Icons.Link className="h-5 w-5" />
                  <span className="sr-only">Attach file</span>
                </Button>
                <Button 
                  type="button" 
                  size="icon"
                  variant="ghost"
                  className="rounded-xl h-[39px] w-[39px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
                  title="Web search"
                >
                  <Icons.Search className="h-5 w-5" />
                  <span className="sr-only">Web search</span>
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // For uncontrolled textarea, ignore message prop changes
  return (
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.conversationId === nextProps.conversationId &&
    prevProps.isChatListCollapsed === nextProps.isChatListCollapsed &&
    prevProps.isAgentOnlyConversation === nextProps.isAgentOnlyConversation &&
    prevProps.handleMessageChange === nextProps.handleMessageChange &&
    prevProps.textareaRef === nextProps.textareaRef &&
    JSON.stringify(prevProps.leadData) === JSON.stringify(nextProps.leadData)
  )
}) 