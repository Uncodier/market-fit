"use client"

import React, { RefObject } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import Link from "next/link"
import { useTheme } from "@/app/context/ThemeContext"
import { ChatMessage } from "@/app/types/chat"
import { EmptyConversation } from "./EmptyConversation"
import * as Icons from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

// Helper function to format date as "Month Day, Year"
const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

// Helper function to check if two dates are the same day
const isSameDay = (date1: Date, date2: Date) => {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

interface ChatMessagesProps {
  chatMessages: ChatMessage[]
  isLoadingMessages: boolean
  isAgentResponding: boolean
  messagesEndRef: RefObject<HTMLDivElement | null>
  agentId: string
  agentName: string
  isAgentOnlyConversation: boolean
  leadData: any
}

export function ChatMessages({
  chatMessages,
  isLoadingMessages,
  isAgentResponding,
  messagesEndRef,
  agentId,
  agentName,
  isAgentOnlyConversation,
  leadData
}: ChatMessagesProps) {
  // Use theme context for dark mode detection
  const { isDarkMode } = useTheme()

  return (
    <div className="flex-1 overflow-auto py-6 bg-muted/30 transition-colors duration-300 ease-in-out pt-[91px] pb-[200px]">
      <div className="max-w-[calc(100%-240px)] mx-auto">
        {isLoadingMessages ? (
          <div className="space-y-6 w-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} animate-pulse`}>
                {i % 2 === 0 ? (
                  <div className="flex items-start gap-3 max-w-[calc(100%-240px)]">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-primary/20"></div>
                    </div>
                    <div className="space-y-2 w-[350px]">
                      <div className="h-4 bg-primary/10 rounded w-24"></div>
                      <div className="rounded-lg p-4 bg-background" style={{ 
                        boxShadow: 'var(--shadow-sm)',
                        border: '1px solid var(--border)'
                      }}>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[90%]"></div>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[75%] mt-2"></div>
                        <div className="h-4 bg-muted-foreground/10 rounded w-[85%] mt-2"></div>
                        <div className="h-3 bg-muted-foreground/10 rounded w-14 mt-2"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-end gap-3 max-w-[calc(100%-240px)]">
                    <div className="space-y-2 w-[350px]">
                      <div className="bg-muted/40 rounded-lg p-4" style={{ 
                        backgroundColor: 'var(--muted)', 
                        border: 'none', 
                        boxShadow: 'none', 
                        outline: 'none',
                        filter: 'none'
                      }}>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[90%]"></div>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[70%] mt-2"></div>
                        <div className="h-4 bg-muted-foreground/20 rounded w-[80%] mt-2"></div>
                        <div className="h-3 bg-muted-foreground/15 rounded w-14 mt-2 ml-auto"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {chatMessages.length === 0 ? (
              <EmptyConversation 
                agentId={agentId}
                agentName={agentName}
              />
            ) : (
              chatMessages.map((msg, index) => {
                // Check if we need to show a date separator
                const showDateSeparator = index > 0 && 
                  !isSameDay(
                    new Date(chatMessages[index-1].timestamp), 
                    new Date(msg.timestamp)
                  );
                
                return (
                  <React.Fragment key={msg.id || index}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-8">
                        <Badge variant="outline" className="px-3 py-1 text-xs bg-background/80 backdrop-blur">
                          {formatDate(new Date(msg.timestamp))}
                        </Badge>
                      </div>
                    )}
                    <div
                      className={`flex ${
                        msg.role === "team_member" 
                        ? (isAgentOnlyConversation ? "justify-end" : "justify-start")
                        : (msg.role === "user" || msg.role === "visitor") ? "justify-end" : "justify-start"
                      } animate-fade-in`}
                    >
                      {msg.role === "team_member" && !isAgentOnlyConversation ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)]">
                          <div className="flex items-center mb-1 gap-2">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: msg.sender_id 
                                  ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ml-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : msg.role === "team_member" && isAgentOnlyConversation ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] items-end">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={msg.sender_avatar || `/avatars/user-default.png`} alt={msg.sender_name || "Team Member"} style={{ objectFit: 'cover' }} />
                              <AvatarFallback className="text-xs bg-primary/10" style={{
                                backgroundColor: msg.sender_id 
                                  ? `hsl(${parseInt(msg.sender_id.replace(/[^a-f0-9]/gi, '').substring(0, 6), 16) % 360}, 70%, 65%)`
                                  : undefined
                              }}>
                                {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : (msg.sender_id ? msg.sender_id.charAt(0).toUpperCase() : "T")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{msg.sender_name || `Team Member (${msg.sender_id ? msg.sender_id.substring(0, 6) + '...' : 'Unknown'})`}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (msg.role === "agent" || msg.role === "assistant") ? (
                        <div className="max-w-[calc(100%-240px)]">
                          <div className="flex items-center mb-1 gap-2">
                            <Avatar className="h-7 w-7 border border-primary/10">
                              <AvatarImage src={`/avatars/agent-${agentId}.png`} alt={agentName} />
                              <AvatarFallback className="bg-primary/10">
                                {agentName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-primary">{agentName}</span>
                          </div>
                          <div className="ml-9">
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>
                      ) : (msg.role === "user" || msg.role === "visitor") ? (
                        <div className="flex flex-col max-w-[calc(100%-240px)] items-end">
                          <div className="flex items-center mb-1 gap-2 flex-row-reverse">
                            <Avatar className="h-7 w-7 border border-amber-500/20">
                              <AvatarImage src={leadData?.avatarUrl || "/avatars/visitor-default.png"} alt={leadData?.name || "Visitor"} />
                              <AvatarFallback className="bg-amber-500/10 text-amber-600">
                                {leadData?.name ? leadData.name.split(' ').map((n: string) => n[0]).join('') : "V"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-500">{leadData?.name || "Visitor"}</span>
                          </div>
                          <div className="rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground mr-9"
                            style={{ 
                              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                              border: 'none', 
                              boxShadow: 'none', 
                              outline: 'none',
                              filter: 'none' 
                            }}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <div className="flex items-center justify-between mt-1.5">
                              <div>
                                {msg.metadata?.command_status === "failed" && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                          <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                          Failed to send
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <p className="text-xs opacity-70 text-right">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="max-w-[calc(100%-240px)] rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground"
                          style={{ 
                            backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                            border: 'none', 
                            boxShadow: 'none', 
                            outline: 'none',
                            filter: 'none' 
                          }}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <div>
                              {msg.metadata?.command_status === "failed" && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center text-xs text-red-500 mr-2">
                                        <Icons.AlertCircle className="h-3 w-3 mr-1" />
                                        Failed to send
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{msg.metadata?.error_message || "Message failed to reach the server"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <p className="text-xs opacity-70">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })
            )}
            
            {/* Animación de espera mientras el agente responde */}
            {isAgentResponding && isAgentOnlyConversation && (
              <div className="flex justify-start animate-fade-in">
                <div className="max-w-[calc(100%-240px)] flex items-center space-x-2 p-4">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
} 