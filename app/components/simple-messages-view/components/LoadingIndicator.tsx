import React from 'react'
import { formatTime } from '../utils'

interface LoadingIndicatorProps {
  isVisible: boolean
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ isVisible }) => {
  if (!isVisible) return null

  return (
    <div className="flex flex-col w-full min-w-0 items-start group">
      <div className="flex items-center mb-1 gap-2 w-full min-w-0">
        <div className="relative">
          <div className="h-7 w-7 border border-primary/20 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            A
          </div>
        </div>
        <span className="text-sm font-medium text-primary">Robot</span>
        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
          thinking
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTime(new Date())}
        </span>
      </div>
      
      {/* Loading message content */}
      <div className="mr-8 w-full min-w-0 overflow-hidden">
        <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words whitespace-pre-wrap bg-background/50 rounded-lg p-4 border border-dashed border-primary/20">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm">Robot is thinking...</span>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2 mb-0">
            Processing your request and preparing a response
          </p>
        </div>
      </div>
    </div>
  )
}
