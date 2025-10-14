import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Bot, Image as ImageIcon, PlayCircle, Speaker, ChevronRight } from "@/app/components/ui/icons"
import { ContextSelectorModal } from "@/app/components/ui/context-selector-modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { OptimizedTextarea } from "@/app/components/ui/optimized-textarea"
import { type SelectedContextIds } from '@/app/services/context-service'
import { MediaParametersToolbar } from './MediaParametersToolbar'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'

interface MessageInputProps {
  message: string
  selectedActivity: string
  selectedContext: SelectedContextIds
  onMessageChange: (message: string) => void
  onActivityChange: (activity: string) => void
  onContextChange: (context: SelectedContextIds) => void
  onSubmit: () => void
  disabled: boolean
  placeholder: string
  textareaRef: React.RefObject<HTMLTextAreaElement>
  // Media parameters
  imageParameters: ImageParameters
  videoParameters: VideoParameters
  audioParameters: AudioParameters
  onImageParameterChange: (key: keyof ImageParameters, value: any) => void
  onVideoParameterChange: (key: keyof VideoParameters, value: any) => void
  onAudioParameterChange: (key: keyof AudioParameters, value: any) => void
}

const MessageInputComponent: React.FC<MessageInputProps> = ({
  message,
  selectedActivity,
  selectedContext,
  onMessageChange,
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
  onAudioParameterChange
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  // Calculate dropdown direction based on position
  const handleDropdownToggle = () => {
    if (!isDropdownOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const dropdownHeight = 80 // Approximate height of dropdown
      
      // Since this dropdown is at the bottom of the screen, always check if there's enough space
      // If less than 100px below, open upward
      if (spaceBelow < 100) {
        setDropdownDirection('up')
      } else {
        setDropdownDirection('down')
      }
    }
    setIsDropdownOpen(!isDropdownOpen)
  }
  return (
    <div className="flex-none transition-all duration-300 ease-in-out w-full" style={{ width: '100%', minWidth: '100%' }}>
      <div className="px-[30px] w-full" style={{ width: '100%', minWidth: '100%' }}>
        <form className="relative w-full" style={{ width: '100%', minWidth: '100%' }} onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}>
          <div className="relative w-full" style={{ width: '100%', minWidth: '100%' }}>
            <OptimizedTextarea
              ref={textareaRef}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onSubmit()
                }
              }}
              placeholder={placeholder}
              className="resize-none min-h-[135px] w-full py-5 pl-[30px] pr-[30px] rounded-2xl border border-input bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
              disabled={disabled}
              style={{
                lineHeight: '1.5',
                overflowY: 'hidden',
                wordWrap: 'break-word',
                paddingBottom: '50px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                height: '135px', // Initial height, will be auto-adjusted
                width: '100%',
                minWidth: '100%',
                maxWidth: '100%'
              }}
            />
            
            {/* Context selector button in bottom left */}
            <div className="absolute bottom-[15px] left-[15px] z-50">
              <div className="flex items-center gap-2">
                {/* Activity selector - Custom component for Safari compatibility */}
                <div className="relative" ref={dropdownRef}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 px-3 hover:bg-secondary/80 transition-colors duration-200 text-xs w-40 justify-start"
                    onClick={handleDropdownToggle}
                  >
                    <div className="flex items-center w-full">
                      <div className="flex items-center justify-center safari-icon-fix w-[18px] h-[18px]">
                        {selectedActivity === 'ask' && <MessageSquare className="h-[18px] w-[18px] shrink-0 text-blue-600" />}
                        {selectedActivity === 'robot' && <Bot className="h-[18px] w-[18px] shrink-0 text-purple-600" />}
                      </div>
                      <div className="flex flex-col min-w-0 ml-2">
                        <span className="truncate">{selectedActivity === 'ask' ? 'Ask' : selectedActivity === 'robot' ? 'Robot' : 'Select activity'}</span>
                      </div>
                      <ChevronRight className="h-3 w-3 ml-auto rotate-90" />
                    </div>
                  </Button>
                  
                  {isDropdownOpen && (
                    <div className={`absolute left-0 w-40 bg-background border border-border rounded-md shadow-lg z-50 ${
                      dropdownDirection === 'up' 
                        ? 'bottom-full mb-1' 
                        : 'top-full mt-1'
                    }`}>
                      <div className="p-1">
                        <div 
                          className="flex items-center px-2 py-1.5 hover:bg-accent cursor-pointer rounded-sm"
                          onClick={() => {
                            onActivityChange('ask')
                            setIsDropdownOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-center safari-icon-fix w-[18px] h-[18px]">
                            <MessageSquare className="h-[18px] w-[18px] shrink-0 text-blue-600" />
                          </div>
                          <div className="flex flex-col min-w-0 ml-2">
                            <span className="truncate">Ask</span>
                          </div>
                        </div>
                        <div 
                          className="flex items-center px-2 py-1.5 hover:bg-accent cursor-pointer rounded-sm"
                          onClick={() => {
                            onActivityChange('robot')
                            setIsDropdownOpen(false)
                          }}
                        >
                          <div className="flex items-center justify-center safari-icon-fix w-[18px] h-[18px]">
                            <Bot className="h-[18px] w-[18px] shrink-0 text-purple-600" />
                          </div>
                          <div className="flex flex-col min-w-0 ml-2">
                            <span className="truncate">Robot</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Media Parameters Toolbar */}
                <MediaParametersToolbar
                  selectedActivity={selectedActivity}
                  imageParameters={imageParameters}
                  videoParameters={videoParameters}
                  audioParameters={audioParameters}
                  onImageParameterChange={onImageParameterChange}
                  onVideoParameterChange={onVideoParameterChange}
                  onAudioParameterChange={onAudioParameterChange}
                />
                
                {/* Context button, same height */}
                <ContextSelectorModal 
                  selectedContext={selectedContext}
                  onContextChange={onContextChange}
                />
              </div>
            </div>
            
            {/* Send button on the right */}
            <div className="absolute bottom-[15px] right-[15px]" style={{ zIndex: 51 }}>
              <Button 
                type="submit" 
                size="icon"
                variant="ghost"
                disabled={disabled || !message.trim()}
                className={`rounded-[9999px] h-[39px] w-[39px] transition-all duration-200 ${
                  !disabled && message.trim()
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground hover:scale-105 active:scale-95 shadow-sm hover:shadow-lg hover:shadow-primary/25 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background opacity-100'
                    : 'text-muted-foreground opacity-50 hover:bg-transparent'
                }`}
              >
                <ChevronRight className="h-5 w-5" />
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
