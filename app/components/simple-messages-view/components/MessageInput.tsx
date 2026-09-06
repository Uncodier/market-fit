import React, { useEffect, useRef, useState } from 'react'
import { ArrowUp, Plus } from "@/app/components/ui/icons"
import { ContextSelectorModal } from "@/app/components/ui/context-selector-modal"
import { Button } from "@/app/components/ui/button"
import { OptimizedTextarea } from "@/app/components/ui/optimized-textarea"
import { type SelectedContextIds } from '@/app/services/context-service'
import { MediaParametersToolbar } from './MediaParametersToolbar'
import { ActivitySelector } from './ActivitySelector'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'
import { useAttachmentUpload } from '../hooks/useAttachmentUpload'
import { useRequirementStatus } from '../hooks/useRequirementStatus'
import { useSite } from '@/app/context/SiteContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { areMentionsEqual, getMentionQuery } from '@/app/components/context/mention-query'
import { ContextMentionPicker } from '@/app/components/context/context-mention-picker'

const COMPOSER_TEXTAREA_STYLE: React.CSSProperties = {
  lineHeight: '1.5',
  overflowY: 'hidden',
  wordWrap: 'break-word',
  paddingBottom: '60px',
  height: '135px',
  width: '100%',
}

interface MessageInputProps {
  message: string
  selectedActivity: string
  selectedContext: SelectedContextIds
  onMessageChange: (message: string) => void
  handleMessageChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onActivityChange: (activity: string) => void
  onContextChange: (context: SelectedContextIds) => void
  onSubmit: () => void
  disabled: boolean
  placeholder: string
  textareaRef: React.RefObject<HTMLTextAreaElement> | React.MutableRefObject<HTMLTextAreaElement | null>
  // Media parameters
  imageParameters: ImageParameters
  videoParameters: VideoParameters
  audioParameters: AudioParameters
  onImageParameterChange: (key: keyof ImageParameters, value: any) => void
  onVideoParameterChange: (key: keyof VideoParameters, value: any) => void
  onAudioParameterChange: (key: keyof AudioParameters, value: any) => void
  // Instance prop
  activeRobotInstance?: any
  isBrowserVisible?: boolean
}

const MessageInputComponent: React.FC<MessageInputProps> = ({
  message,
  selectedActivity,
  selectedContext,
  onMessageChange,
  handleMessageChange,
  onActivityChange,
  onContextChange,
  onSubmit,
  disabled,
  placeholder,
  textareaRef,
  imageParameters,
  videoParameters,
  audioParameters,
  onImageParameterChange,
  onVideoParameterChange,
  onAudioParameterChange,
  activeRobotInstance,
  isBrowserVisible = false
}) => {
  const [mentionState, setMentionState] = useState<{ query: string, start: number, end: number } | null>(null)
  const [hasInput, setHasInput] = useState(() => message.trim().length > 0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const { uploadFile, isUploading } = useAttachmentUpload({ 
    siteId: currentSite?.id || '',
    instanceId: activeRobotInstance?.id
  })

  // Fetch requirement status for this instance
  const { requirementStatuses } = useRequirementStatus(activeRobotInstance)
  const latestRequirementStatus = requirementStatuses.length > 0 ? requirementStatuses[requirementStatuses.length - 1] : null
  const rawRequirements = latestRequirementStatus?.requirements
  const requirementName = Array.isArray(rawRequirements) ? rawRequirements[0]?.title : rawRequirements?.title

  useEffect(() => {
    setHasInput(message.trim().length > 0)
  }, [message])

  // Calculate dynamic placeholder based on context and requirements
  const contextCount = Object.values(selectedContext).reduce((acc: number, curr: any) => acc + (curr?.length || 0), 0) as number
  
  let dynamicPlaceholder = placeholder
  if (placeholder === 'Ask anything...' || placeholder === 'Ask anything' || placeholder === 'Pregunta cualquier cosa...' || placeholder === 'Pregunta cualquier cosa' || placeholder === '¿Cómo te puedo ayudar hoy?') {
    const askAnythingStr = t('chat.askAnything') !== 'chat.askAnything' ? t('chat.askAnything') : '¿Cómo te puedo ayudar hoy?'
    const aboutStr = t('chat.about') !== 'chat.about' ? t('chat.about') : 'sobre'
    const andStr = t('chat.and') !== 'chat.and' ? t('chat.and') : 'y'
    const itemStr = t('chat.item') !== 'chat.item' ? t('chat.item') : 'elemento de contexto'
    const itemsStr = t('chat.items') !== 'chat.items' ? t('chat.items') : 'elementos de contexto'
    const currentItemsStr = contextCount === 1 ? itemStr : itemsStr
    
    if (requirementName && contextCount > 0) {
      dynamicPlaceholder = `${askAnythingStr} ${aboutStr} ${requirementName} ${andStr} ${contextCount} ${currentItemsStr}...`
    } else if (requirementName) {
      dynamicPlaceholder = `${askAnythingStr} ${aboutStr} ${requirementName}...`
    } else if (contextCount > 0) {
      dynamicPlaceholder = `${askAnythingStr} ${aboutStr} ${contextCount} ${currentItemsStr}...`
    } else {
      dynamicPlaceholder = `${askAnythingStr}...`
    }
  }

  const applyComposerValue = (value: string, event?: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextHasInput = value.trim().length > 0
    setHasInput((prev) => (prev === nextHasInput ? prev : nextHasInput))

    const cursorPosition = event?.target.selectionStart ?? value.length
    const mention = getMentionQuery(value, cursorPosition)
    setMentionState((prev) => (areMentionsEqual(prev, mention) ? prev : mention))

    if (handleMessageChange && event) {
      handleMessageChange(event)
    } else if (handleMessageChange) {
      handleMessageChange({ target: { value } } as React.ChangeEvent<HTMLTextAreaElement>)
    } else {
      onMessageChange(value)
    }
  }

  const handleMentionSelect = (type: keyof SelectedContextIds, id: string, name: string) => {
    // Add to context
    const newContext = { ...selectedContext }
    newContext[type] = [...(newContext[type] || []), id]
    onContextChange(newContext)

    // Remove @query from text
    if (mentionState && textareaRef && "current" in textareaRef && textareaRef.current) {
      const currentText = textareaRef.current.value
      const before = currentText.slice(0, mentionState.start)
      const after = currentText.slice(mentionState.end)
      const newText = before + after
      
      textareaRef.current.value = newText
      applyComposerValue(newText, { target: textareaRef.current } as React.ChangeEvent<HTMLTextAreaElement>)
      
      // Reset cursor
      const newCursorPos = mentionState.start
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          textareaRef.current.focus()
        }
      }, 0)
    }
    
    setMentionState(null)
  }

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      await uploadFile(file)
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex-none w-full" style={{ width: '100%' }}>
      <div className="mx-auto w-full max-w-[800px]">
        <form id="message-form" name="messageForm" className="relative w-full" onSubmit={(e) => {
          e.preventDefault()
          if (!mentionState) onSubmit()
        }}>
          <div className="relative w-full">
            {mentionState && (
              <ContextMentionPicker 
                query={mentionState.query} 
                onSelect={handleMentionSelect}
                onClose={() => setMentionState(null)} 
              />
            )}
            
            <OptimizedTextarea
              id="message-input"
              name="message"
              data-1p-ignore="true"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              ref={textareaRef}
              defaultValue={message}
              onChange={(e) => applyComposerValue(e.target.value, e)}
              onKeyDown={(e) => {
                if (mentionState) {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    return
                  }
                }
                
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (!mentionState) {
                    onSubmit()
                  }
                }
              }}
              placeholder={dynamicPlaceholder}
              className="resize-none min-h-[135px] w-full py-4 pl-[27px] pr-[27px] rounded-2xl border border-input focus-visible:outline-none bg-background text-base box-border peer"
              disabled={disabled}
              style={{
                ...COMPOSER_TEXTAREA_STYLE,
                opacity: disabled ? 1 : undefined
              }}
            />
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {/* Context selector button in bottom left */}
            <div className="absolute bottom-[15px] left-[15px] z-50">
              <div className="flex items-center gap-2">
                <ActivitySelector
                  selectedActivity={selectedActivity}
                  onActivityChange={onActivityChange}
                />
                
                <MediaParametersToolbar
                  selectedActivity={selectedActivity}
                  imageParameters={imageParameters}
                  videoParameters={videoParameters}
                  audioParameters={audioParameters}
                  onImageParameterChange={onImageParameterChange}
                  onVideoParameterChange={onVideoParameterChange}
                  onAudioParameterChange={onAudioParameterChange}
                  isBrowserVisible={isBrowserVisible}
                />
                
                <ContextSelectorModal 
                  selectedContext={selectedContext}
                  onContextChange={onContextChange}
                  isBrowserVisible={isBrowserVisible}
                  hideChips={true}
                />
              </div>
            </div>
            
            {/* Attachment and Send buttons on the right */}
            <div className="absolute bottom-[15px] right-[15px] flex items-center gap-2" style={{ zIndex: 51 }}>
              <Button 
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled || isUploading || !activeRobotInstance?.id}
                onClick={() => fileInputRef.current?.click()}
                className={`rounded-[9999px] h-[35.1px] w-[35.1px] transition-all duration-200 ${
                  !disabled && !isUploading && activeRobotInstance?.id
                    ? 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    : 'text-muted-foreground opacity-50 hover:bg-transparent'
                }`}
                title={!activeRobotInstance?.id ? 'Start a conversation first to attach files' : 'Attach file'}
              >
                <Plus className="h-4.5 w-4.5" />
                <span className="sr-only">Attach file</span>
              </Button>
              
              <Button 
                type="submit" 
                size="icon"
                disabled={disabled || !hasInput}
                className="h-[35.1px] w-[35.1px] shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                <ArrowUp className="h-4.5 w-4.5" />
                <span className="sr-only">Send</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export const MessageInput = React.memo(MessageInputComponent)
