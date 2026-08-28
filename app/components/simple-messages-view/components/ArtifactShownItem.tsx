import React from 'react'
import { Sparkles, LayoutGrid } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { InstanceLog } from '../types'
import { formatTime } from '../utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '../utils/markdownComponents'
import { parseToolMessageKvs } from '../parse-tool-call'

interface ArtifactShownItemProps {
  log: InstanceLog
  isDarkMode: boolean
  isBrowserVisible?: boolean
}

export const ArtifactShownItem: React.FC<ArtifactShownItemProps> = ({
  log,
  isDarkMode,
  isBrowserVisible = false
}) => {
  // Parse tool args
  let args: any = {}
  if (typeof log.tool_args === 'string') {
    try {
      args = JSON.parse(log.tool_args)
    } catch (e) {
      console.error('Failed to parse tool_args', e)
    }
  } else if (log.tool_args && typeof log.tool_args === 'object') {
    args = log.tool_args
  }

  // Fallback to parsing from message if args are empty or don't have thought_process/title
  if (!args.title && !args.thought_process && log.message) {
    const kvs = parseToolMessageKvs(log.message)
    if (kvs.title || kvs.thought_process) {
      args = { ...args, ...kvs }
    }
  }

  const { title, screen, thought_process } = args

  
  return (
    <div className="flex flex-col w-full min-w-0 items-start group mt-2 mb-2">
      <div className="flex items-center mb-1 gap-2 w-full">
        <div className="relative">
          <Avatar className="h-7 w-7 border border-primary/20 bg-primary/10">
            <AvatarFallback className="bg-transparent text-primary">
              <Sparkles className="w-3.5 h-3.5" />
            </AvatarFallback>
          </Avatar>
        </div>
        <span className="text-sm font-medium text-primary">
          Actualización de UI
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTime(new Date(log.created_at))}
        </span>
      </div>
      
      {/* Thought Process Content */}
      {thought_process && (
        <div className="w-full min-w-0 overflow-hidden mb-3">
          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', paddingLeft: isBrowserVisible ? '0.75rem' : '2.25rem' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {thought_process}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Artifact Card */}
      <div className={`w-full ${isBrowserVisible ? 'pl-3' : 'pl-9'}`}>
        <div 
          className="rounded-lg p-3 border flex flex-col gap-1 w-full max-w-md"
          style={{
            backgroundColor: isDarkMode ? '#252533' : '#f8f9fa',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }}
        >
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <LayoutGrid className="w-4 h-4" />
            <span>Artefacto Mostrado</span>
          </div>
          {title && (
            <div className="text-sm text-foreground">
              {title}
            </div>
          )}
          {screen && (
            <div className="text-xs text-muted-foreground mt-1 bg-black/5 dark:bg-white/5 w-fit px-2 py-0.5 rounded-full">
              Pantalla: {screen}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
