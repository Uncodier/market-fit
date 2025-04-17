"use client"

import React, { FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import * as Icons from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  message: string
  setMessage: (message: string) => void
  isLoading: boolean
  handleSendMessage: (e: FormEvent) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  handleSendMessage,
  handleKeyDown
}: ChatInputProps) {
  return (
    <div className={cn(
      "py-4 flex-none chat-input-container transition-all duration-300 ease-in-out fixed w-[-webkit-fill-available] bottom-0 bg-background/95"
    )}>
      <div className="max-w-[calc(100%-240px)] mx-auto">
        <form onSubmit={handleSendMessage} className="relative">
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              className="resize-none h-[135px] w-full py-5 pl-[60px] pr-[60px] rounded-2xl border border-input bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 text-base box-border transition-all duration-300 ease-in-out"
              disabled={isLoading}
              style={{
                lineHeight: '1.5',
                overflowY: 'auto',
                wordWrap: 'break-word',
                paddingBottom: '50px', // Espacio adicional en la parte inferior
                backdropFilter: 'blur(10px)'
              }}
            />
            {/* Botones de acciones a la izquierda */}
            <div className="absolute bottom-[15px] left-[15px] flex space-x-1">
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
            
            {/* Botón de enviar a la derecha */}
            <div className="absolute bottom-[15px] right-[15px]">
              <Button 
                type="submit" 
                size="icon"
                variant="ghost"
                disabled={isLoading || !message.trim()}
                className={`rounded-xl h-[39px] w-[39px] text-primary hover:text-primary/90 transition-colors hover:bg-muted ${!message.trim() ? 'opacity-50' : 'opacity-100'}`}
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
} 