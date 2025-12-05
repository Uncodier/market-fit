import React from 'react'
import { User, ChevronRight, ChevronDown, File, Check } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { InstanceLog } from '../types'
import { formatTime } from '../utils'
import { useUserProfile } from '../hooks/useUserProfile'
import ReactMarkdown from 'react-markdown'
import { markdownComponents } from '../utils/markdownComponents'

interface MessageItemProps {
  log: InstanceLog
  isDarkMode: boolean
  collapsedSystemMessages: Set<string>
  onToggleSystemMessageCollapse: (messageId: string) => void
  isBrowserVisible?: boolean
}


export const MessageItem: React.FC<MessageItemProps> = ({
  log,
  isDarkMode,
  collapsedSystemMessages,
  onToggleSystemMessageCollapse,
  isBrowserVisible = false
}) => {
  const { userProfile } = useUserProfile(log.user_id || null)
  
  // Extract status from details object
  const status = log.details?.status


  // User action message - styled like user messages in chat
  if (log.log_type === 'user_action') {
    return (
      <div className="flex flex-col w-full min-w-0 items-end group">
        <div className="flex items-center mb-1 gap-2 justify-end">
          <span className="text-xs text-muted-foreground">
            {formatTime(new Date(log.created_at))}
          </span>
          <span className="text-sm font-medium text-primary">
            {userProfile?.name || 'User'}
          </span>
          <div className="relative">
            <Avatar className="h-7 w-7 border border-primary/20">
              {userProfile?.avatar_url && (
                <AvatarImage 
                  src={userProfile.avatar_url} 
                  alt={userProfile.name || 'User'} 
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary">
                {userProfile?.name 
                  ? userProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                  : <User className="h-4 w-4" />
                }
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
        
        <div className={`w-full min-w-0 overflow-hidden flex justify-end ${isBrowserVisible ? 'pr-2' : 'pr-8'}`}>
          <div className="min-w-0 overflow-hidden">
            <div 
              className={`text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words rounded-lg ${isBrowserVisible ? 'mr-2 p-3' : 'mr-12 p-4'}`}
              style={{ 
                backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                border: 'none', 
                boxShadow: 'none', 
                outline: 'none',
                filter: 'none',
                wordWrap: 'break-word', 
                overflowWrap: 'break-word', 
                wordBreak: 'break-word'
              }}
            >
              <ReactMarkdown components={markdownComponents}>
                {log.message}
              </ReactMarkdown>
            </div>
            
            {/* Display attachments if they exist */}
            {log.details?.attachments && Array.isArray(log.details.attachments) && log.details.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {log.details.attachments.map((attachment: any, index: number) => {
                  const isImage = attachment.type?.startsWith('image/')
                  return (
                    <div key={index} className="relative group">
                      {isImage ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name || `Attachment ${index + 1}`}
                          className="w-16 h-16 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(attachment.url, '_blank')}
                        />
                      ) : (
                        <div 
                          className="w-16 h-16 bg-muted rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          <File className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {attachment.name || `Attachment ${index + 1}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Tool calls are now handled by ToolCallItem component
  // This component only handles regular messages (user_action, system, agent_action, etc.)

  // System/Agent/Instance message - styled like agent messages in chat
  return (
    <div className="flex flex-col w-full min-w-0 items-start group">
      <div className="flex items-center mb-1 gap-2 w-full">
        <div className="relative">
          <Avatar className={`h-7 w-7 border ${
            log.log_type === 'system' ? 'border-blue-500/20' :
            log.log_type === 'agent_action' ? 'border-primary/20' :
            log.log_type === 'error' ? 'border-red-500/20' :
            'border-gray-500/20'
          }`}>
            <AvatarFallback className={`${
              log.log_type === 'system' ? 'bg-blue-500/10 text-blue-600' :
              log.log_type === 'agent_action' ? 'bg-primary/10 text-primary' :
              log.log_type === 'error' ? 'bg-red-500/10 text-red-600' :
              'bg-gray-500/10 text-gray-600'
            }`}>
              {log.log_type === 'system' ? 'S' :
               log.log_type === 'agent_action' ? 'A' :
               log.log_type === 'error' ? 'E' :
               log.log_type === 'tool_call' ? 'T' :
               log.log_type === 'tool_result' ? 'R' : 'I'}
            </AvatarFallback>
          </Avatar>
        </div>
        <span className={`text-sm font-medium ${
          log.log_type === 'system' ? 'text-blue-600' :
          log.log_type === 'agent_action' ? 'text-primary' :
          log.log_type === 'error' ? 'text-red-600' :
          'text-muted-foreground'
        }`}>
          {log.log_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          log.level === 'error' ? 'bg-red-100 text-red-700' :
          log.level === 'warn' ? 'bg-yellow-100 text-yellow-700' :
          log.level === 'info' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {log.level}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTime(new Date(log.created_at))}
        </span>
        
        {/* Status badge - only show for pending status */}
        {status === 'pending' && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border bg-yellow-100/90 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
            <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
            Pending
          </span>
        )}
        
        {/* Collapse button for system messages */}
        {log.log_type === 'system' && (
          <button
            onClick={() => onToggleSystemMessageCollapse(log.id)}
            className="ml-auto p-1 hover:bg-muted rounded transition-colors"
            title={collapsedSystemMessages.has(log.id) ? "Expand message" : "Collapse message"}
          >
            {collapsedSystemMessages.has(log.id) ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>
      
      {/* Message content - collapsible for system messages */}
      {!(log.log_type === 'system' && collapsedSystemMessages.has(log.id)) && (
        <div className="w-full min-w-0 overflow-hidden">
          <div className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', paddingLeft: isBrowserVisible ? '0.75rem' : '2rem' }}>
            <ReactMarkdown components={markdownComponents}>
              {log.message}
            </ReactMarkdown>
          </div>
        </div>
      )}
      
      {/* Collapsed preview for system messages */}
      {log.log_type === 'system' && collapsedSystemMessages.has(log.id) && (
        <div className="w-full min-w-0 overflow-hidden">
          <div className="text-sm text-muted-foreground italic truncate" style={{ paddingLeft: isBrowserVisible ? '0.75rem' : '2rem' }}>
            {log.message.substring(0, 100)}...
          </div>
        </div>
      )}
    </div>
  )
}
