"use client"

import React, { FormEvent, useCallback, useRef, useMemo, memo } from "react"
import { Button } from "@/app/components/ui/button"
import { OptimizedTextarea } from "@/app/components/ui/optimized-textarea"
import * as Icons from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useLayout } from "@/app/context/LayoutContext"
import { ChannelSelector } from "./ChannelSelector"
import { useChannelSelector } from "@/app/hooks/useChannelSelector"
import { useLayoutDimensions } from "@/app/hooks/useLayoutDimensions"

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
  
  // Combine external ref with internal ref
  const setTextareaRef = useCallback((element: HTMLTextAreaElement | null) => {
    internalRef.current = element
    if (externalRef) {
      externalRef.current = element
    }
  }, [externalRef])
  
  // Use optimized layout dimensions hook
  const { containerStyle } = useLayoutDimensions({
    isLayoutCollapsed,
    isChatListCollapsed
  })
  
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
  
  // Memoize send button state - for uncontrolled mode, always enabled when not loading
  const canSend = useMemo(() => {
    return !isLoading
  }, [isLoading])
  
  // If no conversation is selected, don't render the input
  if (!hasSelectedConversation) {
    return null
  }
  
  return (
    <div 
      className={cn(
        "fixed bottom-0 py-4 flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10"
      )}
      style={containerStyle}
    >
      <div className="px-12">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <OptimizedTextarea
              ref={setTextareaRef}
              onChange={handleChange}
              onKeyDown={handleKeyDownInternal}
              placeholder="Message..."
              className="resize-none min-h-[135px] w-full py-5 pl-[60px] pr-[60px] rounded-2xl border border-input bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
              disabled={isLoading}
              style={{
                lineHeight: '1.5',
                overflowY: 'hidden',
                wordWrap: 'break-word',
                paddingBottom: '50px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                height: '135px' // Initial height, will be auto-adjusted
              }}
            />
            
            {/* Channel selector centered */}
            <div className="absolute bottom-[15px] left-1/2 transform -translate-x-1/2 flex items-center justify-center">
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
            
            {/* Send button on the right */}
            <div className="absolute bottom-[15px] right-[15px]">
              <Button 
                type="submit" 
                size="icon"
                variant="ghost"
                disabled={!canSend}
                className={cn(
                  "rounded-xl h-[39px] w-[39px] text-primary hover:text-primary/90 transition-colors hover:bg-muted",
                  canSend ? "opacity-100" : "opacity-50"
                )}
              >
                {isLoading ? (
                  <Icons.Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Icons.ChevronRight className="h-5 w-5" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </form>
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