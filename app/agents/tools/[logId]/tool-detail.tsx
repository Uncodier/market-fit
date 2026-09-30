"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

import { Card, CardContent } from "@/app/components/ui/card"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { AlertCircle, PlayCircle, Clock, FileText, Info, Target, User, Bot, Settings, Zap } from "@/app/components/ui/icons"
import { JsonHighlighter } from "@/app/components/agents/json-highlighter"
import { PageTransition } from "@/app/components/ui/page-transition"
import { EmptyCard } from "@/app/components/ui/empty-card"

import type { SingleInstanceLogResponse } from "@/app/agents/actions"
type InstanceLog = NonNullable<SingleInstanceLogResponse["log"]>
import { useEffect } from "react"

import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"

import { formatDate, formatDuration, LevelBadge, LogTypeBadge, formatTokens, renderBase64Images } from "./log-presentation"

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
              { href: '/agents', label: 'Agents' },
              { href: '/agents/tools', label: 'Tools' },
              { href: typeof window !== 'undefined' ? window.location.pathname : '', label: logTitle }
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
  const overviewCard = (
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
            <div className="px-4 md:px-16 pt-0">
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
              {overviewCard}
            </div>
          </div>
        </div>
        </Tabs>
      </div>
    </PageTransition>
  );
}
