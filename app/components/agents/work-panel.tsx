"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { ChevronRight, FileText, MessageSquare, PlayCircle, Code } from "@/app/components/ui/icons"
import { Agent, AgentActivity } from "@/app/types/agents"
import { useAgentSelection } from "@/app/agents/page"
import { CommandsPanel } from "@/app/components/agents/commands-panel"

// Cpu icon for AI agent representation
const Cpu = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <div 
    className={`inline-flex items-center justify-center ${className}`}
    style={{ 
      width: size, 
      height: size, 
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      ...props.style 
    }}
    onClick={props.onClick}
    aria-hidden={props["aria-hidden"] ?? true}
  >
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  </div>
)

export function WorkPanel() {
  // Access context for agent selection
  const { selectedAgent, setSelectedAgent, selectedActivity, setSelectedActivity } = useAgentSelection();

  return (
    <>
      {selectedAgent ? (
        <div className="flex h-full flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-3 py-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Work Panel</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2 text-xs"
              onClick={() => {
                setSelectedAgent(null);
                setSelectedActivity(null);
              }}
            >
              Clear
            </Button>
          </div>
          
          <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/avatars/agent-${selectedAgent.id}.png`} alt={selectedAgent.name} />
                <AvatarFallback className="text-xs">{selectedAgent.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h4 className="font-medium text-sm truncate">{selectedAgent.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{selectedAgent.type.charAt(0).toUpperCase() + selectedAgent.type.slice(1)}</p>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue={selectedActivity ? "task" : "info"} className="flex-1 overflow-hidden flex flex-col">
            <div className="px-3">
              <TabsList className="w-full h-9 grid-cols-4">
                <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
                <TabsTrigger value="task" className="text-xs">Task</TabsTrigger>
                <TabsTrigger value="chat" className="text-xs">Chat</TabsTrigger>
                <TabsTrigger value="commands" className="text-xs">Commands</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 overflow-auto">
              <TabsContent value="info" className="p-3 h-full">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium mb-1.5">Description</div>
                    <p className="text-xs text-muted-foreground">{selectedAgent.description}</p>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium mb-1.5">Status</div>
                    <Badge variant="outline" className="text-xs">
                      {selectedAgent.status.charAt(0).toUpperCase() + selectedAgent.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium mb-1.5">Metrics</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Card className="col-span-1">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs">Success Rate</CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 px-3">
                          <div className="text-lg font-bold">{selectedAgent.successRate}%</div>
                        </CardContent>
                      </Card>
                      <Card className="col-span-1">
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-xs">Conversations</CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 px-3">
                          <div className="text-lg font-bold">{selectedAgent.conversations}</div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium mb-1.5">Activities</div>
                    <div className="space-y-1">
                      {selectedAgent.activities && selectedAgent.activities.map((activity) => (
                        <Button 
                          key={activity.id}
                          variant="ghost" 
                          className="w-full justify-start px-2 py-1.5 h-auto text-left"
                          onClick={() => setSelectedActivity(activity)}
                        >
                          <div className="truncate">
                            <div className="text-xs font-medium truncate">{activity.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{activity.estimatedTime}</div>
                          </div>
                          <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="task" className="p-0 h-full">
                {selectedActivity ? (
                  <div className="h-full flex flex-col">
                    <div className="px-3 py-3 border-b">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium">Current Task</div>
                        <Badge variant="outline" className="text-[10px]">{selectedActivity.estimatedTime}</Badge>
                      </div>
                      <div className="text-sm font-medium mt-1.5">{selectedActivity.name}</div>
                      <p className="text-xs text-muted-foreground mt-1">{selectedActivity.description}</p>
                    </div>
                    
                    <div className="px-3 py-3 border-b">
                      <div className="text-xs font-medium mb-1.5">Task Stats</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Success Rate</span>
                          <span className="text-sm font-medium">{selectedActivity.successRate}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Previous Runs</span>
                          <span className="text-sm font-medium">{selectedActivity.executions}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center p-3">
                      <Button className="w-full" size="sm">
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Execute Task
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center p-3">
                    <div className="text-center space-y-1.5">
                      <div className="flex justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground opacity-80" />
                      </div>
                      <h4 className="text-sm font-medium">No task selected</h4>
                      <p className="text-xs text-muted-foreground">Select an activity from the Info tab</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="chat" className="p-0 h-full">
                <div className="h-full flex flex-col items-center justify-center p-3">
                  <div className="text-center space-y-1.5">
                    <div className="flex justify-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground opacity-80" />
                    </div>
                    <h4 className="text-sm font-medium">Start a conversation</h4>
                    <p className="text-xs text-muted-foreground">Chat with this agent directly</p>
                    <Button className="mt-3 w-full" size="sm">
                      New Chat
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="commands" className="p-0 h-full">
                <CommandsPanel />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      ) : (
        <div className="h-full flex flex-col">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-3 py-3">
            <h3 className="text-sm font-medium">Work Panel</h3>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center space-y-1.5">
              <div className="flex justify-center">
                <Cpu className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
              <h4 className="text-sm font-medium">Select an agent to start working</h4>
              <p className="text-xs text-muted-foreground">Agent details and actions will appear here</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 