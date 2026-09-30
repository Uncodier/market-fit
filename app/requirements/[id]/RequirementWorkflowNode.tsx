"use client"

import { AddSecretDialog } from "@/app/components/ui/add-secret-dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"

import {
AlertCircle,
Bot,
CalendarIcon,
Code,
Database,
Globe,
GripHorizontal,
Key,
X
} from "@/app/components/ui/icons"
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/app/components/ui/select"
import { Tabs,TabsList,TabsTrigger } from "@/app/components/ui/tabs"
import { cn } from "@/lib/utils"

import { type WorkflowNode } from "./requirement-detail-types"
import { RequirementWorkflowPorts } from "./RequirementWorkflowPorts"
import type { RequirementController } from "./use-requirement-controller"
export function RequirementWorkflowNode({ controller, node }: { controller: RequirementController; node: WorkflowNode }) {
  const { nodes, setNodes, connections, setConnections, isConnecting, hoveredNodeId, setHoveredNodeId, selectedConnectionId, setSelectedConnectionId, setUnsavedChanges } = controller
                    const isSelected = selectedConnectionId === null && hoveredNodeId === node.id;
                    const isCurrentlyHovered = hoveredNodeId === node.id && !isConnecting;
                    return (
                    <div 
                      key={node.id}
                      className={cn(
                        "absolute rounded-3xl border-2 bg-card/95 backdrop-blur-sm cursor-grab active:cursor-grabbing w-[280px] flex flex-col overflow-visible transition-shadow duration-300 select-none shadow-[0_0_10px_rgba(0,0,0,0.05)] hover:shadow-[0_0_20px_rgba(0,0,0,0.15)]",
                        node.type === 'trigger' ? "border-primary/50" : "border-black/5 dark:border-white/10"
                      )}
                      style={{
                        left: node.position.x,
                        top: node.position.y
                      }}
                      onMouseEnter={() => {
                        if (!isConnecting) setHoveredNodeId(node.id);
                      }}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onMouseDown={(e) => {
                        e.stopPropagation(); // Stop propagation to canvas
                        setSelectedConnectionId(null);
                        
                        const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                        const scale = canvasEl ? canvasEl.getBoundingClientRect().width / canvasEl.offsetWidth : 1;
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startPosX = node.position.x;
                        const startPosY = node.position.y;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          moveEvent.preventDefault();
                          if (window.getSelection) {
                            window.getSelection()?.removeAllRanges();
                          }
                          const dx = (moveEvent.clientX - startX) / scale;
                          const dy = (moveEvent.clientY - startY) / scale;
                          
                          setNodes(currentNodes => currentNodes.map(n => 
                            n.id === node.id 
                              ? { ...n, position: { x: startPosX + dx, y: startPosY + dy } }
                              : n
                          ));
                          setUnsavedChanges(true);
                        };
                        
                        const handleMouseUp = () => {
                          window.removeEventListener('mousemove', handleMouseMove);
                          window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                        };
                        
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                      }}
                    >
                      {/* Node Header */}
                      <div className={cn(
                        "px-3 py-2.5 border-b flex items-center justify-between rounded-t-xl gap-2 relative",
                        node.type === 'trigger' ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border/40"
                      )}>
                        {/* Drag Handle Overlay */}
                        <div 
                          className={cn(
                            "absolute inset-x-0 -top-6 h-6 bg-transparent flex items-center justify-center opacity-0 transition-all duration-200 cursor-grab active:cursor-grabbing",
                            hoveredNodeId === node.id ? "opacity-100 -translate-y-1" : ""
                          )}
                        >
                          <div className="bg-background/90 px-3 py-1 rounded-t-lg border-x border-t border-border/50 shadow-sm backdrop-blur-sm flex items-center justify-center pointer-events-none">
                            <GripHorizontal className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        </div>
                              
                        <span className="absolute -top-[18px] left-1 text-[10px] font-bold text-muted-foreground/60 pointer-events-none uppercase tracking-widest z-10 select-none">{node.type}</span>
                        {node.type === 'trigger' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.triggerType || 'schedule'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, triggerType: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="schedule" className="text-[10px] py-1 px-2 h-6" title="Schedule">
                                  <CalendarIcon className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Time
                                </TabsTrigger>
                                <TabsTrigger value="webhook" className="text-[10px] py-1 px-2 h-6" title="Webhook">
                                  <Globe className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Hook
                                </TabsTrigger>
                                <TabsTrigger value="db_event" className="text-[10px] py-1 px-2 h-6" title="Database Event">
                                  <Database className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  DB Event
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : node.type === 'action' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.actionType || 'agent'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, actionType: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="agent" className="text-[10px] py-1 px-2 h-6" title="Agent">
                                  <Bot className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Agent
                                </TabsTrigger>
                                <TabsTrigger value="code" className="text-[10px] py-1 px-2 h-6" title="Code">
                                  <Code className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  Code
                                </TabsTrigger>
                                <TabsTrigger value="api" className="text-[10px] py-1 px-2 h-6" title="API">
                                  <Globe className="h-3 w-3 mr-1.5 hidden sm:inline-block" />
                                  API
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : node.type === 'condition' ? (
                          <div className="flex items-center gap-2 flex-1 mt-1 z-10" onMouseDown={e => e.stopPropagation()}>
                            <Tabs 
                              value={node.data.logicalOperator || 'AND'} 
                              onValueChange={(value) => {
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, logicalOperator: value } } : n
                                ));
                                setUnsavedChanges(true);
                              }}
                              className="w-full"
                            >
                              <TabsList className="grid w-full grid-cols-2 h-8 p-1 bg-muted/50">
                                <TabsTrigger value="AND" className="text-[10px] py-1 px-2 h-6" title="AND (All conditions met)">
                                  AND
                                </TabsTrigger>
                                <TabsTrigger value="OR" className="text-[10px] py-1 px-2 h-6" title="OR (Any condition met)">
                                  OR
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>
                          </div>
                        ) : null}
                      </div>

                      {/* Node Body */}
                      <div className="p-4 flex-1" onMouseDown={e => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn(
                            "h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-opacity absolute -right-6 -top-2 cursor-pointer z-10",
                            hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodes(nodes.filter(n => n.id !== node.id));
                            setConnections(connections.filter(c => c.from !== node.id && c.to !== node.id));
                            setUnsavedChanges(true);
                          }}
                          onMouseDown={(e) => {
                            // Prevenir que el click en el botón inicie el drag del nodo
                            e.stopPropagation();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        {node.type !== 'trigger' && (
                          <div className="relative">
                                <Textarea 
                              value={node.data.label || ''}
                              placeholder={`New ${node.type} description...`}
                              className={cn(
                                "min-h-[60px] resize-none text-sm font-medium border-transparent hover:border-border focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 p-1.5 -ml-1.5 transition-all bg-transparent w-[calc(100%+12px)] overflow-hidden",
                                node.type === 'trigger' ? "focus-visible:bg-background/50" : "focus-visible:bg-background",
                                "selection:bg-primary/20"
                              )}
                                  onChange={(e) => {
                                // Adjust height automatically
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                                
                                setNodes(nodes.map(n => 
                                  n.id === node.id ? { ...n, data: { ...n.data, label: e.target.value } } : n
                                ));
                                    setUnsavedChanges(true);
                                  }}
                              onKeyDown={(e) => {
                                // Stop dragging when typing
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                // Focus on textarea without triggering node drag
                                e.stopPropagation();
                              }}
                            />
                              </div>
                        )}
                        
                        {node.type === 'secret' && (
                          <div className="relative flex flex-col gap-2" onMouseDown={e => e.stopPropagation()}>
                            <div className="text-xs text-muted-foreground">Secret Name</div>
                            <div className="font-mono text-sm font-medium">{node.data.secret_name || 'Unnamed Secret'}</div>
                            
                            <div className="text-[10px] text-muted-foreground mt-2">Secret ID</div>
                            <div className="text-xs font-mono text-muted-foreground truncate">{node.data.secret_id}</div>
                            
                            {!node.data.secret_id && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                No secret linked. Delete and recreate.
                              </div>
                            )}
                          </div>
                        )}
                        
                        {node.type === 'trigger' && (
                          <div className="relative flex flex-col gap-2" onMouseDown={e => e.stopPropagation()}>
                            {(node.data.triggerType === 'schedule' || !node.data.triggerType) && (
                              <div>
                                <Select 
                                  value={node.data.cron || 'Run once'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, cron: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <CalendarIcon className="h-3 w-3" />
                                      <SelectValue placeholder="Schedule..." />
                                </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Run once">Run once</SelectItem>
                                    <SelectItem value="Every minute">Every minute</SelectItem>
                                    <SelectItem value="Every 5 minutes">Every 5 minutes</SelectItem>
                                    <SelectItem value="Hourly">Hourly</SelectItem>
                                    <SelectItem value="Daily">Daily</SelectItem>
                                    <SelectItem value="Weekly">Weekly</SelectItem>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Custom CRON">Custom CRON...</SelectItem>
                                  </SelectContent>
                                </Select>
                                
                                {node.data.cron === 'Custom CRON' && (
                                  <div className="mt-2">
                                    <Input 
                                      placeholder="* * * * *" 
                                      className="h-8 font-mono text-xs bg-background/50"
                                      value={node.data.customCron || ''}
                                      onChange={(e) => {
                                        setNodes(nodes.map(n => 
                                          n.id === node.id ? { ...n, data: { ...n.data, customCron: e.target.value } } : n
                                        ));
                                        setUnsavedChanges(true);
                                      }}
                                      onMouseDown={e => e.stopPropagation()}
                                      onKeyDown={e => e.stopPropagation()}
                                    />
                                    <p className="text-[9px] text-muted-foreground mt-1 ml-1">Format: min hour dom month dow</p>
                                </div>
                                )}
                              </div>
                            )}

                            {node.data.triggerType === 'webhook' && (
                              <div className="flex flex-col gap-1.5">
                                <Input 
                                  placeholder="/api/webhooks/..." 
                                  className="h-8 text-xs bg-background/50 font-mono"
                                  value={node.data.webhookPath || ''}
                                  onChange={(e) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, webhookPath: e.target.value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                  onMouseDown={e => e.stopPropagation()}
                                  onKeyDown={e => e.stopPropagation()}
                                />
                                <p className="text-[9px] text-muted-foreground ml-1">Webhook Endpoint Path</p>
                                </div>
                            )}

                            {node.data.triggerType === 'db_event' && (
                              <div className="flex flex-col gap-1.5">
                                <Select 
                                  value={node.data.dbTable || 'tasks'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, dbTable: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50 font-mono">
                                    <SelectValue placeholder="Table" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="tasks">tasks</SelectItem>
                                    <SelectItem value="messages">messages</SelectItem>
                                    <SelectItem value="leads">leads</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Select 
                                  value={node.data.dbEvent || 'insert'} 
                                  onValueChange={(value) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, dbEvent: value } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-background/50">
                                    <SelectValue placeholder="Event Type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="insert">INSERT</SelectItem>
                                    <SelectItem value="update">UPDATE</SelectItem>
                                    <SelectItem value="delete">DELETE</SelectItem>
                                    <SelectItem value="all">ALL EVENTS</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            </div>
                        )}

                        {node.type === 'action' && (
                          <div className="mt-3 flex flex-col gap-2 px-1" onMouseDown={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-medium">Retries</span>
                              <Input 
                                type="number" 
                                min="0"
                                max="10"
                                className="h-7 w-16 text-xs bg-background/50 text-center focus-visible:ring-1 focus-visible:ring-primary/30"
                                value={node.data.retries ?? 0}
                                onChange={(e) => {
                                  setNodes(nodes.map(n => 
                                    n.id === node.id ? { ...n, data: { ...n.data, retries: parseInt(e.target.value) || 0 } } : n
                                  ));
                                  setUnsavedChanges(true);
                                }}
                                onMouseDown={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                              />
                            </div>
                            <div className="h-px bg-border/50 w-full my-1"></div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-medium">Secret</span>
                              <div className="flex gap-1 items-center">
                                {node.data.secret_id ? (
                                  <span className="text-[10px] text-primary truncate max-w-[80px]" title={node.data.secret_name || 'Secret attached'}>
                                    {node.data.secret_name || 'Attached'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">None</span>
                                )}
                                <AddSecretDialog 
                                  onSecretCreated={(id, name) => {
                                    setNodes(nodes.map(n => 
                                      n.id === node.id ? { ...n, data: { ...n.data, secret_id: id, secret_name: name } } : n
                                    ));
                                    setUnsavedChanges(true);
                                  }}
                                  trigger={
                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2 whitespace-nowrap" title={node.data.secret_id ? "Change Secret" : "Add Secret"}>
                                      <Key className="h-3 w-3 mr-1" />
                                      {node.data.secret_id ? "Change" : "Add Secret"}
                                    </Button>
                                  }
                                />
                                {node.data.secret_id && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0" 
                                    title="Remove Secret"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setNodes(nodes.map(n => {
                                        if (n.id === node.id) {
                                          const newData = { ...n.data };
                                          delete newData.secret_id;
                                          delete newData.secret_name;
                                          return { ...n, data: newData };
                                        }
                                        return n;
                                      }));
                                      setUnsavedChanges(true);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                        </div>
                      )}
                </div>
                
                      <RequirementWorkflowPorts controller={controller} node={node} />
                        </div>
                      );
}
