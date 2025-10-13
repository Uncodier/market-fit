import React from 'react'
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
  return (
    <div className="flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-[20] w-full" style={{ width: '100%', minWidth: '100%' }}>
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
                {/* Activity selector replaced with new options */}
                <Select value={selectedActivity} onValueChange={onActivityChange}>
                  <SelectTrigger className="h-8 text-xs w-[160px] bg-secondary hover:bg-secondary/80 border-secondary flex items-center">
                    <SelectValue className="truncate flex items-center gap-2" placeholder="Select activity">
                      {selectedActivity === 'ask' && <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" style={{ verticalAlign: 'middle', display: 'inline-block', position: 'relative' }} />}
                      {selectedActivity === 'robot' && <Bot className="h-3.5 w-3.5 flex-shrink-0 text-purple-600" style={{ verticalAlign: 'middle', display: 'inline-block', position: 'relative' }} />}
                      <span style={{ verticalAlign: 'middle' }}>
                        {selectedActivity === 'ask' ? 'Ask' : selectedActivity === 'robot' ? 'Robot' : 'Select activity'}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ask" textValue="Ask" hideIndicator className="data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700">
                      <span className="flex items-center gap-2 min-w-0 whitespace-nowrap" style={{ alignItems: 'center', display: 'flex' }}>
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-blue-600" style={{ verticalAlign: 'middle', display: 'inline-block', position: 'relative' }} />
                        <span className="truncate" style={{ verticalAlign: 'middle' }}>Ask</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="robot" textValue="Robot" hideIndicator className="data-[state=checked]:bg-purple-50 data-[state=checked]:text-purple-700">
                      <span className="flex items-center gap-2 min-w-0 whitespace-nowrap" style={{ alignItems: 'center', display: 'flex' }}>
                        <Bot className="h-3.5 w-3.5 flex-shrink-0 text-purple-600" style={{ verticalAlign: 'middle', display: 'inline-block', position: 'relative' }} />
                        <span className="truncate" style={{ verticalAlign: 'middle' }}>Robot</span>
                      </span>
                    </SelectItem>
                    {/* Hidden media generation options */}
                    {/* <SelectItem value="generate-image" textValue="Generate Image" hideIndicator className="data-[state=checked]:bg-green-50 data-[state=checked]:text-green-700">
                      <span className="flex items-center gap-2 min-w-0 whitespace-nowrap"><ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-green-600" /><span className="truncate">Generate Image</span></span>
                    </SelectItem>
                    <SelectItem value="generate-video" textValue="Generate Video" hideIndicator className="data-[state=checked]:bg-red-50 data-[state=checked]:text-red-700">
                      <span className="flex items-center gap-2 min-w-0 whitespace-nowrap"><PlayCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-600" /><span className="truncate">Generate Video</span></span>
                    </SelectItem>
                    <SelectItem value="generate-audio" textValue="Generate Audio" hideIndicator className="data-[state=checked]:bg-amber-50 data-[state=checked]:text-amber-700">
                      <span className="flex items-center gap-2 min-w-0 whitespace-nowrap"><Speaker className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" /><span className="truncate">Generate Audio</span></span>
                    </SelectItem> */}
                  </SelectContent>
                </Select>
                
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
