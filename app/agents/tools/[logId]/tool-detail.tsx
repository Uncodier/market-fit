"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { 
  AlertCircle, 
  CheckCircle2, 
  PlayCircle, 
  ChevronLeft, 
  Clock, 
  FileText, 
  Info, 
  Target, 
  User,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Bot,
  Settings,
  XCircle,
  Image,
  Zap
} from "@/app/components/ui/icons"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"
import { PageTransition } from "@/app/components/ui/page-transition"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { cn } from "@/app/lib/utils"
import { InstanceLog } from "@/app/agents/actions"
import { useEffect, useState } from "react"
import React from "react"
import { useSupabase } from "@/app/hooks/use-supabase"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"

// For consistent formatting of dates across the application
function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch (error) {
    console.error("Invalid date format:", dateString);
    return "Invalid Date";
  }
}

// Helper function to format duration in ms to human-readable format
function formatDuration(durationMs: number | undefined | null) {
  if (durationMs === undefined || durationMs === null) return "N/A";
  
  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

// Component to show log level with proper styling
function LevelBadge({ level }: { level: string }) {
  switch (level) {
    case "debug":
      return (
        <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted/30">
          <Info className="h-3.5 w-3.5 mr-1.5" />
          Debug
        </Badge>
      );
    case "info":
      return (
        <Badge variant="outline" className="bg-info/10 text-info border-info/30">
          <Info className="h-3.5 w-3.5 mr-1.5" />
          Info
        </Badge>
      );
    case "warn":
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
          Warning
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Error
        </Badge>
      );
    case "critical":
      return (
        <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/40">
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Critical
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {level}
        </Badge>
      );
  }
}

// Component to show log type with proper styling
function LogTypeBadge({ logType }: { logType: string }) {
  const getIcon = () => {
    switch (logType) {
      case "system":
        return <FileText className="h-3.5 w-3.5 mr-1.5" />;
      case "user_action":
        return <User className="h-3.5 w-3.5 mr-1.5" />;
      case "agent_action":
        return <Bot className="h-3.5 w-3.5 mr-1.5" />;
      case "tool_call":
        return <Settings className="h-3.5 w-3.5 mr-1.5" />;
      case "tool_result":
        return <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 mr-1.5" />;
      case "performance":
        return <Zap className="h-3.5 w-3.5 mr-1.5" />;
      default:
        return <FileText className="h-3.5 w-3.5 mr-1.5" />;
    }
  };

  return (
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
      {getIcon()}
      {logType.replace('_', ' ')}
    </Badge>
  );
}

// Format token usage display
function formatTokens(tokensUsed?: any) {
  if (!tokensUsed) return "N/A";
  
  if (typeof tokensUsed === 'object') {
    const promptTokens = tokensUsed.promptTokens || tokensUsed.prompt_tokens || 0;
    const completionTokens = tokensUsed.completionTokens || tokensUsed.completion_tokens || 0;
    const totalTokens = tokensUsed.totalTokens || tokensUsed.total_tokens || (promptTokens + completionTokens);
    
    if (totalTokens > 0) {
      return `${promptTokens.toLocaleString()} / ${completionTokens.toLocaleString()} (${totalTokens.toLocaleString()} total)`;
    }
  }
  
  return "N/A";
}

// Render base64 images in content
function renderBase64Images(contentString: string) {
  const imageRegex = /(data:image\/[^;]+;base64,[^\s"]+)/g;
  const urlRegex = /(https?:\/\/[^\s"]+)/g;
  
  const extractMatches = (regex: RegExp, type: string) => {
    const matches = [];
    let match;
    
    regex.lastIndex = 0;
    
    while ((match = regex.exec(contentString)) !== null) {
      matches.push({
        type,
        value: match[0],
        index: match.index
      });
    }
    
    return matches;
  };
  
  const imageMatches = extractMatches(imageRegex, 'image');
  const urlMatches = extractMatches(urlRegex, 'url');
  
  if (imageMatches.length === 0 && urlMatches.length === 0) {
    return (
      <pre 
        className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
        style={{ wordWrap: 'break-word', maxWidth: '100%' }}
      >{contentString}</pre>
    );
  }

  const allMatches = [...imageMatches, ...urlMatches].sort((a, b) => a.index - b.index);
  
  const parts = [];
  let lastIndex = 0;
  
  for (const match of allMatches) {
    const matchIndex = match.index;
    
    if (matchIndex > lastIndex) {
      parts.push({
        type: 'text',
        value: contentString.substring(lastIndex, matchIndex)
      });
    }
    
    parts.push(match);
    lastIndex = matchIndex + match.value.length;
  }
  
  if (lastIndex < contentString.length) {
    parts.push({
      type: 'text',
      value: contentString.substring(lastIndex)
    });
  }
  
  return (
    <div className="space-y-4">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part.type === 'text' && part.value.trim() && (
            <pre 
              className="text-sm whitespace-pre-wrap font-mono max-w-full overflow-x-auto break-all break-words"
              style={{ wordWrap: 'break-word', maxWidth: '100%' }}
            >{part.value}</pre>
          )}
          {part.type === 'image' && (
            <div className="my-4">
              <img 
                src={part.value} 
                alt="Screenshot" 
                className="max-w-full h-auto rounded-lg border shadow-sm"
                style={{ maxHeight: '400px' }}
              />
            </div>
          )}
          {part.type === 'url' && (
            <div className="my-2">
              <a 
                href={part.value} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline break-all"
              >
                {part.value}
              </a>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ToolDetail({ log, logId }: { log: InstanceLog | null, logId: string }) {
  const router = useRouter();
  
  // Update the page title and breadcrumb when log is loaded
  useEffect(() => {
    if (log) {
      try {
        const logTitle = `${log.tool_name || 'Tool'} Log`;
        const agentName = log.agents?.name || 'Agent';
        const pageTitle = `${logTitle} - ${agentName}`;
        
        // Update the page title for the browser tab
        document.title = `${pageTitle} | Agents`;
        
      // Emit a custom event to update the breadcrumb with log title
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: logTitle,
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          section: 'agents',
          breadcrumb: (
            <Breadcrumb items={[
              { href: '/agents', label: 'Agents', isCurrent: false },
              { href: '/agents/tools', label: 'Tools', isCurrent: false },
              { href: typeof window !== 'undefined' ? window.location.pathname : '', label: logTitle, isCurrent: true }
            ]} />
          )
        }
      });
        
        // Ensure event is dispatched after DOM is updated
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
          }
        }, 0);
      } catch (error) {
        console.error('Error updating breadcrumb:', error);
      }
    }
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Agents | Market Fit';
    };
  }, [log, logId]);
  
  if (!log) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <EmptyCard
          icon={<FileText className="h-10 w-10 text-muted-foreground" />}
          title="Log not found"
          description="The requested log could not be found."
          showShadow={false}
        />
      </div>
    );
  }

  // Component Overview Card that will always be visible
  const OverviewCard = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Basic Log Information */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
              Log Information
            </h3>
            
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <Info className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Log Type</p>
                  <LogTypeBadge logType={log.log_type} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <AlertCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Level</p>
                  <LevelBadge level={log.level} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-[5px]">Created At</p>
                  <p className="text-sm">{formatDate(log.created_at)}</p>
                </div>
              </div>

              {log.duration_ms && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <PlayCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-[5px]">Duration</p>
                    <p className="text-sm">{formatDuration(log.duration_ms)}</p>
                  </div>
                </div>
              )}

              {log.tokens_used && (
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-[5px]">Token Usage</p>
                    <p className="text-sm">{formatTokens(log.tokens_used)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tool Information */}
          {(log.tool_name || log.tool_call_id || log.step_id) && (
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Tool Information
              </h3>
              
              <div className="grid gap-4">
                {log.tool_name && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Tool Name</p>
                      <p className="text-sm font-medium">{log.tool_name}</p>
                    </div>
                  </div>
                )}

                {log.tool_call_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Tool Call ID</p>
                      <p className="text-sm font-mono">{log.tool_call_id}</p>
                    </div>
                  </div>
                )}

                {log.step_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <PlayCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Step ID</p>
                      <p className="text-sm font-mono">{log.step_id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relationships */}
          {(log.parent_log_id || log.instance_id || log.agent_id || log.command_id) && (
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Relationships
              </h3>
              
              <div className="grid gap-4">
                {log.parent_log_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Parent Log ID</p>
                      <p className="text-sm font-mono">{log.parent_log_id}</p>
                    </div>
                  </div>
                )}

                {log.instance_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Instance ID</p>
                      <p className="text-sm font-mono">{log.instance_id}</p>
                    </div>
                  </div>
                )}

                {log.agent_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Agent ID</p>
                      <p className="text-sm font-mono">{log.agent_id}</p>
                    </div>
                  </div>
                )}

                {log.command_id && (
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                      <PlayCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-[5px]">Command ID</p>
                      <p className="text-sm font-mono">{log.command_id}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <Tabs defaultValue="details">
          <StickyHeader>
            <div className="px-16 pt-0">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                {log.tool_args && <TabsTrigger value="toolArgs">Tool Args</TabsTrigger>}
                {log.tool_result && <TabsTrigger value="toolResult">Tool Result</TabsTrigger>}
                {log.screenshot_base64 && <TabsTrigger value="screenshots">Screenshots</TabsTrigger>}
                {log.artifacts && <TabsTrigger value="artifacts">Artifacts</TabsTrigger>}
                {log.tokens_used && <TabsTrigger value="performance">Performance</TabsTrigger>}
              </TabsList>
            </div>
          </StickyHeader>

          <div className="container flex-1 items-start py-6 max-w-screen-2xl">
            <div className="flex flex-col space-y-6 lg:flex-row lg:space-x-6 lg:space-y-0">
              {/* Left Column: Log Details */}
              <div className="space-y-6 lg:flex-1">

                <Card>
                  <CardContent className="pt-6">
                    <TabsContent value="details" className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Message</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            {renderBase64Images(log.message)}
                          </div>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-muted-foreground mb-2">Details</h3>
                            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                              <JsonHighlighter data={log.details} />
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {log.tool_args && (
                      <TabsContent value="toolArgs" className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tool Arguments</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <JsonHighlighter data={log.tool_args} />
                          </div>
                        </div>
                      </TabsContent>
                    )}

                    {log.tool_result && (
                      <TabsContent value="toolResult" className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tool Result</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <JsonHighlighter data={log.tool_result} />
                          </div>
                        </div>
                      </TabsContent>
                    )}

                    {log.screenshot_base64 && (
                      <TabsContent value="screenshots" className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Screenshot</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <img 
                              src={log.screenshot_base64} 
                              alt="Screenshot" 
                              className="max-w-full h-auto rounded-lg border shadow-sm"
                              style={{ maxHeight: '600px' }}
                            />
                          </div>
                        </div>
                      </TabsContent>
                    )}

                    {log.artifacts && (
                      <TabsContent value="artifacts" className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Artifacts</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <JsonHighlighter data={log.artifacts} />
                          </div>
                        </div>
                      </TabsContent>
                    )}

                    {log.tokens_used && (
                      <TabsContent value="performance" className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Token Usage</h3>
                          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                            <JsonHighlighter data={log.tokens_used} />
                          </div>
                        </div>
                      </TabsContent>
                    )}
                  </CardContent>
                </Card>
              </div>

            {/* Right Column: Overview Card */}
            <div className="lg:w-1/3">
              <OverviewCard />
            </div>
          </div>
        </div>
        </Tabs>
      </div>
    </PageTransition>
  );
}
