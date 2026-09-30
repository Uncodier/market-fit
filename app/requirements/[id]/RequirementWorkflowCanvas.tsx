"use client"

import { AddSecretDialog } from "@/app/components/ui/add-secret-dialog"
import { Button } from "@/app/components/ui/button"

import { ZoomableCanvas } from "@/app/components/agents/zoomable-canvas"
import {
Code,
GitFork,
Key,
X,
Zap
} from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

import { RequirementWorkflowNode } from "./RequirementWorkflowNode"
import type { RequirementController } from "./use-requirement-controller"
export function RequirementWorkflowCanvas({ controller }: { controller: RequirementController }) {
  const { showRightPanel, activeView, nodes, connections, setConnections, isConnecting, currentMousePos, hoveredNodeId, setHoveredNodeId, selectedConnectionId, setSelectedConnectionId, setUnsavedChanges, handleAddRequirementSecret, handleAddNode } = controller
  return (
              <ZoomableCanvas 
                className="w-full h-full" 
                recenterDependency={`${showRightPanel}-${activeView}`}
                dotColorLight="rgba(0, 0, 0, 0.15)"
                dotColorDark="rgba(255, 255, 255, 0.15)"
                dotSize="20px"
                dotRadius="1.5px"
                extraControls={
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleAddNode('trigger')} className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-xs">
                      <Zap className="h-3 w-3 mr-1.5 text-primary" /> Trigger
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleAddNode('action')} className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-xs">
                      <Code className="h-3 w-3 mr-1.5 text-primary" /> Action
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleAddNode('condition')} className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-xs">
                      <GitFork className="h-3 w-3 mr-1.5 text-primary" /> Condition
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <AddSecretDialog 
                      onSecretCreated={handleAddRequirementSecret}
                      trigger={
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted font-normal text-xs">
                          <Key className="h-3 w-3 mr-1.5 text-primary" /> Add Secret
                        </Button>
                      }
                    />
                  </div>
                }
              >
                <div className="w-full h-full relative min-h-[1000px] min-w-[1000px]">
                  {isConnecting && currentMousePos && (
                    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 10 }}>
                      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                        <path 
                          d={`M ${isConnecting.startX} ${isConnecting.startY} C ${isConnecting.startX + Math.max(50, Math.abs(currentMousePos.x - isConnecting.startX) / 2)} ${isConnecting.startY}, ${currentMousePos.x - Math.max(50, Math.abs(currentMousePos.x - isConnecting.startX) / 2)} ${currentMousePos.y}, ${currentMousePos.x} ${currentMousePos.y}`}
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2"
                          strokeDasharray="4 4"
                          className="text-primary/60"
                        />
                      </svg>
            </div>
                  )}

                  {connections.map(conn => {
                    const fromNode = nodes.find(n => n.id === conn.from);
                    const toNode = nodes.find(n => n.id === conn.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    // Determine starting Y based on sourceHandle
                    let startYOffset = 46; // default top-[40px]
                    if (conn.sourceHandle === 'false' || conn.sourceHandle === 'fail' || conn.sourceHandle === 'fail_intent') {
                      startYOffset = 86; // top-[80px]
                    }
                    if (conn.sourceHandle === 'fail_all') {
                      startYOffset = 126; // top-[120px]
                    }
                    
                    // Fixed node width and dot offset
                    const startX = fromNode.position.x + 280; 
                    const startY = fromNode.position.y + startYOffset;
                    const endX = toNode.position.x;
                    const endY = toNode.position.y + 46;
                    
                    // Bezier curve
                    const controlPointX1 = startX + Math.max(50, Math.abs(endX - startX) / 2);
                    const controlPointX2 = endX - Math.max(50, Math.abs(endX - startX) / 2);
                    
                    const isSelected = selectedConnectionId === conn.id;
                    const isHovered = hoveredNodeId === conn.id;
                    const midX = startX + (endX - startX) / 2;
                    const midY = startY + (endY - startY) / 2;
                    
                    return (
                      <div 
                        key={conn.id} 
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
                        style={{ zIndex: isSelected || isHovered ? 5 : 0 }}
                        onMouseEnter={() => setHoveredNodeId(conn.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                          <path 
                            d={`M ${startX} ${startY} C ${controlPointX1} ${startY}, ${controlPointX2} ${endY}, ${endX} ${endY}`}
                            fill="none" 
                            stroke="transparent" 
                            strokeWidth="24"
                            className="cursor-pointer pointer-events-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConnectionId(conn.id);
                            }}
                            onMouseEnter={() => setHoveredNodeId(conn.id)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                          />
                          <path 
                            d={`M ${startX} ${startY} C ${controlPointX1} ${startY}, ${controlPointX2} ${endY}, ${endX} ${endY}`}
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth={isSelected || isHovered ? "3" : "2"}
                            className={cn(
                              "pointer-events-none transition-all duration-200",
                              (isSelected || isHovered) ? "text-primary" : "text-muted-foreground/30"
                            )}
                          />
                          <polygon 
                            points={`${endX-6},${endY-4} ${endX},${endY} ${endX-6},${endY+4}`} 
                            fill="currentColor"
                            className={cn(
                              "pointer-events-none transition-all duration-200",
                              (isSelected || isHovered) ? "text-primary" : "text-muted-foreground/30"
                            )}
                          />
                        </svg>
                        
                        <div 
                          className={cn(
                            "absolute pointer-events-auto transition-opacity duration-200",
                            (isSelected || isHovered) ? "opacity-100" : "opacity-0"
                          )}
                          style={{ 
                            left: midX, 
                            top: midY,
                            transform: 'translate(-50%, -50%)'
                          }}
                          onMouseEnter={() => setHoveredNodeId(conn.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                        >
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6 rounded-full shadow-md bg-destructive hover:bg-destructive/90 text-destructive-foreground z-20 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnections(connections.filter(c => c.id !== conn.id));
                              setSelectedConnectionId(null);
                              setHoveredNodeId(null);
                              setUnsavedChanges(true);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          </div>
                      </div>
                    );
                  })}
                  
                  {nodes.map(node => <RequirementWorkflowNode key={node.id} node={node} controller={controller} />)}
                </div>
              </ZoomableCanvas>

  )
}
