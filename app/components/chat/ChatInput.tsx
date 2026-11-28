"use client"

import React, { FormEvent, useCallback, useRef, useMemo, memo, useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { OptimizedTextarea } from "@/app/components/ui/optimized-textarea"
import * as Icons from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { cn } from "@/lib/utils"
import { useLocalization } from '@/app/context/LocalizationContext'
import { useLayout } from "@/app/context/LayoutContext"
import { DisabledReasonTooltip } from "./DisabledReasonTooltip"
import { ChannelSelector } from "./ChannelSelector"
import { ResponseFormatSelector } from './ResponseFormatSelector'
import { supportsAudioResponse, type ChatResponseFormat } from '@/lib/chat/response-format'
import { useChannelSelector } from "@/app/hooks/useChannelSelector"
import { getVoiceCallBlock, type VoiceCallLead } from "@/lib/chat/voice-call-eligibility"
import { CommentReplyPicker } from './CommentReplyPicker'
import type { CommentReplySelection } from '@/app/hooks/useCommentReplySelection'
// Removed dynamic width calc; align with messages container

interface ChatInputProps {
  message?: string // Optional for uncontrolled mode
  setMessage: (message: string) => void
  handleMessageChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>
  isLoading: boolean
  handleSendMessage: (e: FormEvent, responseFormat?: ChatResponseFormat) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent, responseFormat?: ChatResponseFormat) => void
  conversationId?: string
  isChatListCollapsed?: boolean
  leadData?: VoiceCallLead & {
    id: string
    email?: string
    phone?: string
  } | null
  isAgentOnlyConversation?: boolean
  isConversationReady?: boolean
  channelBlockReasons?: Readonly<Record<string, string>>
  onChannelCommitted?: (channel: string) => void
  commentReplySelection?: CommentReplySelection
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
  isAgentOnlyConversation = false,
  isConversationReady = true,
  commentReplySelection,
  channelBlockReasons,
  onChannelCommitted,
}: ChatInputProps) {
  const { t } = useLocalization()
  const { sidebarWidth } = useLayout()
  const internalRef = useRef<HTMLTextAreaElement>(null)
  
  // Track window width for responsive left offset
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Track whether the textarea has any user input to control send button fill/enable
  const [hasInput, setHasInput] = useState(false)

  const isDirect = !commentReplySelection && !isAgentOnlyConversation
  const {
    selectedChannel,
    setSelectedChannel,
    availableChannels,
    displayChannels = availableChannels,
    isUpdatingChannel,
    channelLoadError,
    retryChannelLoad,
  } = useChannelSelector({
    conversationId,
    leadData,
    channelBlockReasons: isDirect ? channelBlockReasons : undefined,
    onChannelCommitted,
    isAgentOnlyConversation
  })
  const audioSupported = !commentReplySelection && !isAgentOnlyConversation && supportsAudioResponse(selectedChannel)
  const [formatSelection, setFormatSelection] = useState<{ conversationId?: string; value: ChatResponseFormat }>({ conversationId, value: 'text' })
  const responseFormat = audioSupported && formatSelection.conversationId === conversationId ? formatSelection.value : 'text'
  useEffect(() => {
    if (!audioSupported || formatSelection.conversationId !== conversationId) {
      setFormatSelection({ conversationId, value: 'text' })
    }
  }, [audioSupported, conversationId, formatSelection.conversationId])
  const isVoice = !commentReplySelection && selectedChannel === 'voice'
  const voiceBlock = getVoiceCallBlock(leadData)
  const voiceReason = !voiceBlock ? undefined
    : voiceBlock.code === 'VOICE_DO_NOT_CALL' ? (leadData?.do_not_call ? 'chat.input.doNotCall' : 'chat.input.callOptOut')
    : voiceBlock.code === 'VOICE_PHONE_REQUIRED' ? 'chat.input.phoneRequired' : 'chat.input.leadRequired'

  // A persisted channel may no longer be configured. Show it without making it eligible.
  const pickerChannels = useMemo(() => !isDirect ? availableChannels : displayChannels.includes(selectedChannel)
    ? displayChannels : [...displayChannels, selectedChannel], [isDirect, availableChannels, displayChannels, selectedChannel])
  const pickerReasons = useMemo<Readonly<Record<string, string>> | undefined>(() => {
    if (!isDirect) return undefined
    // Preserve explicit voice opt-out even if a recipient reason is supplied.
    if (voiceReason && (!channelBlockReasons?.voice || voiceBlock?.code === 'VOICE_DO_NOT_CALL')) {
      return { ...channelBlockReasons, voice: voiceReason }
    }
    return channelBlockReasons
  }, [isDirect, channelBlockReasons, voiceBlock?.code, voiceReason])
  const channelUnavailable = isDirect && !availableChannels.includes(selectedChannel)
  const sendBlockReason = pickerReasons?.[selectedChannel]
    ?? (selectedChannel === 'whatsapp' && responseFormat === 'audio' ? pickerReasons?.whatsappAudio : undefined)
    ?? (channelUnavailable ? 'chat.input.channelUnavailable' : isVoice ? voiceReason : undefined)
  const sendLabel = commentReplySelection ? t('chat.input.replyPublicly') : isVoice ? t('chat.input.startCall') : t('chat.input.send')
  const sendingBlocked = Boolean(sendBlockReason) || isUpdatingChannel || isLoading || !isConversationReady ||
    Boolean(commentReplySelection && !commentReplySelection.target)
  
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

    // Enter must not become a newline or send through a channel still updating.
    if (e.key === 'Enter' && !e.shiftKey && sendingBlocked) {
      e.preventDefault()
      return
    }
    
    // Delegate complex logic to parent
    handleKeyDown(e, responseFormat)
  }, [handleKeyDown, sendingBlocked, responseFormat])
  
  // Memoize form submit handler
  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    if (sendingBlocked) return
    handleSendMessage(e, responseFormat)
  }, [handleSendMessage, sendingBlocked, responseFormat])
  
  // Memoize conversation validation
  const hasSelectedConversation = useMemo(() => {
    return conversationId && conversationId !== "" && !conversationId.startsWith("new-")
  }, [conversationId])
  
  // Send button is enabled and filled only when there is input and not loading
  const canSend = useMemo(() => {
    const inputPresent = typeof message === 'string' ? message.trim().length > 0 : hasInput
    return inputPresent && !sendingBlocked
  }, [message, hasInput, sendingBlocked])
  
  // If no conversation is selected, don't render the input
  if (!hasSelectedConversation) {
    return null
  }
  
  // Calculate dynamic left offset for fixed positioning
  const getLeftOffset = () => {
    if (typeof window === 'undefined') return '0px';
    if (windowWidth < 768) return '0px'; // Mobile full width
    
    // Chat list width
    const chatListWidth = isChatListCollapsed ? 0 : 319;
    
    return `${sidebarWidth + chatListWidth}px`;
  };

  return (
    <div 
      className={cn(
        "fixed bottom-0 flex-none chat-input-container pointer-events-none transition-all duration-300 ease-in-out bg-transparent z-10 w-full"
      )}
      style={{
        left: getLeftOffset(),
        width: `calc(100% - ${getLeftOffset()})`,
        maxWidth: `calc(100% - ${getLeftOffset()})`
      }}
    >
      <div className="w-full">
        <div className="w-full mx-auto relative pb-[20px] px-4 md:px-8 lg:px-12 xl:px-24">
          <p className="text-xs text-muted-foreground px-2 pb-2 pointer-events-auto" role="status">
            {!isConversationReady ? t('chat.input.loadingSettings')
              : sendBlockReason ? t(sendBlockReason)
              : commentReplySelection ? (commentReplySelection.target ? t('chat.input.publicReplyHint')
                : commentReplySelection.options.length ? t('chat.input.selectCommentHint')
                  : t('chat.input.noCommentHint'))
              : isVoice ? t('chat.input.callHint')
                : isAgentOnlyConversation ? t('chat.input.internalHint')
                  : t('chat.input.interventionHint')}
          </p>
          <form onSubmit={handleSubmit} className="relative w-full pointer-events-auto">
            <div className="relative w-full" id="tour-chat-input">
        <OptimizedTextarea
                ref={externalRef ?? internalRef}
                onChange={handleChange}
                onKeyDown={handleKeyDownInternal}
                placeholder={isVoice ? t('chat.input.callPlaceholder') : t('chat.input.placeholder')}
                className="resize-none w-full py-4 pl-8 pr-[54px] rounded-2xl border border-input bg-background focus-visible:outline-none text-base box-border pt-4 peer"
                disabled={isLoading}
                style={{
                  lineHeight: '1.5',
                  overflowY: 'hidden',
                  wordWrap: 'break-word',
                  paddingBottom: commentReplySelection ? '62px' : '50px',
                  height: '121.5px',
                  opacity: isLoading ? 1 : undefined
                }}
              />

              {commentReplySelection && (
                <div className="absolute bottom-[15px] left-[15px] right-[64px] flex items-center" style={{ zIndex: 52 }}>
                  <CommentReplyPicker selection={commentReplySelection} disabled={isLoading || !isConversationReady} />
                </div>
              )}

              {/* Send button on the right - moved after textarea */}
              <div className="absolute bottom-[15px] right-[15px]" style={{ zIndex: 51 }}>
                <DisabledReasonTooltip label={sendLabel} reason={sendBlockReason && t(sendBlockReason)}>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!canSend}
                    className="h-[35.1px] w-[35.1px] shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <LoadingSkeleton size="sm" />
                    ) : (
                      <Icons.ArrowUp className="h-4.5 w-4.5" />
                    )}
                    <span className="sr-only">{sendLabel}</span>
                  </Button>
                </DisabledReasonTooltip>
              </div>
              
              {/* Channel selector centered */}
              {channelLoadError && !commentReplySelection && (
                <div role="alert" className="flex items-center gap-2 px-3 pb-14 text-xs text-destructive">
                  <span>{t('chat.input.channelLoadError')}</span>
                  <Button type="button" variant="outline" size="sm" onClick={retryChannelLoad} disabled={isLoading}>
                    {t('chat.input.retryChannel')}
                  </Button>
                </div>
              )}
      <div className="absolute bottom-[15px] left-[15px] right-[64px] flex items-center justify-center gap-2 overflow-x-auto [&>*]:shrink-0" style={{ zIndex: 52 }}>
        {!commentReplySelection && <ChannelSelector
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          availableChannels={availableChannels}
          displayChannels={pickerChannels}
          channelBlockReasons={pickerReasons}
          isUpdating={isUpdatingChannel}
        />}
        {audioSupported && <ResponseFormatSelector
          value={responseFormat}
          onChange={value => setFormatSelection({ conversationId, value })}
          disabled={sendingBlocked}
        />}
      </div>
      
      {/* Action buttons on the left (currently hidden) */}
      <div className="absolute bottom-[15px] left-[15px] flex space-x-1 hidden">
        <Button 
          type="button" 
          size="icon"
          variant="ghost"
          className="rounded-xl h-[35.1px] w-[35.1px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
          title={t('chat.input.attachFile')}
        >
          <Icons.Link className="h-4.5 w-4.5" />
          <span className="sr-only">{t('chat.input.attachFile')}</span>
        </Button>
        <Button 
          type="button" 
          size="icon"
          variant="ghost"
          className="rounded-xl h-[35.1px] w-[35.1px] text-muted-foreground hover:text-foreground transition-colors hover:bg-muted"
          title={t('chat.input.webSearch')}
        >
          <Icons.Search className="h-4.5 w-4.5" />
          <span className="sr-only">{t('chat.input.webSearch')}</span>
        </Button>
      </div>
            </div>
          </form>
          {audioSupported && selectedChannel === 'whatsapp' && responseFormat === 'audio' && (
            <p className="px-3 pt-1 text-xs text-muted-foreground">
              {t('chat.input.whatsappAudioHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.message === nextProps.message &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.conversationId === nextProps.conversationId &&
    prevProps.isChatListCollapsed === nextProps.isChatListCollapsed &&
    prevProps.isAgentOnlyConversation === nextProps.isAgentOnlyConversation &&
    prevProps.isConversationReady === nextProps.isConversationReady &&
    prevProps.channelBlockReasons === nextProps.channelBlockReasons &&
    prevProps.onChannelCommitted === nextProps.onChannelCommitted &&
    prevProps.commentReplySelection === nextProps.commentReplySelection &&
    prevProps.handleMessageChange === nextProps.handleMessageChange &&
    prevProps.setMessage === nextProps.setMessage &&
    prevProps.handleSendMessage === nextProps.handleSendMessage &&
    prevProps.handleKeyDown === nextProps.handleKeyDown &&
    prevProps.textareaRef === nextProps.textareaRef &&
    JSON.stringify(prevProps.leadData) === JSON.stringify(nextProps.leadData)
  )
}) 