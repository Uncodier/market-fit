"use client"


import { cn } from "@/lib/utils"

import { type WorkflowNode } from "./requirement-detail-types"
import type { RequirementController } from "./use-requirement-controller"
export function RequirementWorkflowPorts({ controller, node }: { controller: RequirementController; node: WorkflowNode }) {
  const { connections, setConnections, isConnecting, setIsConnecting, setCurrentMousePos, hoveredNodeId, setUnsavedChanges } = controller
  return <>
                      {/* Connection dots */}
                      {node.type !== 'trigger' && (
                        <div 
                          className={cn(
                            "absolute top-[40px] -left-1.5 h-3 w-3 bg-background border-2 border-muted-foreground/40 rounded-full z-10 cursor-crosshair hover:bg-muted-foreground/20 transition-all duration-200",
                            (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId !== node.id)) ? "opacity-100 scale-125 border-primary/60 shadow-sm" : "opacity-0 scale-50"
                          )}
                          onMouseUp={(e) => {
                            e.stopPropagation();
                            if (isConnecting && isConnecting.fromNodeId !== node.id) {
                              setConnections([...connections, {
                                id: `conn-${Date.now()}`,
                                from: isConnecting.fromNodeId,
                                to: node.id,
                                sourceHandle: isConnecting.sourceHandle
                              }]);
                              setIsConnecting(null);
                              setCurrentMousePos(null);
                              setUnsavedChanges(true);
                            }
                          }}
                        ></div>
                      )}

                      {node.type === 'trigger' && (
                        <div 
                          className={cn(
                            "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-muted-foreground/40 rounded-full z-10 cursor-crosshair hover:bg-muted-foreground/20 transition-all duration-200",
                            (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-primary/60 shadow-sm" : "opacity-0 scale-50"
                          )}
                          onMouseDown={(e) => {
                          e.stopPropagation();
                          const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                          const canvasRect = canvasEl?.getBoundingClientRect();
                          if (canvasRect && canvasEl) {
                            const scale = canvasRect.width / canvasEl.offsetWidth;
                            const startX = node.position.x + 280;
                            const startY = node.position.y + 46;
                            setIsConnecting({ fromNodeId: node.id, startX, startY });
                            setCurrentMousePos({
                              x: (e.clientX - canvasRect.left) / scale,
                              y: (e.clientY - canvasRect.top) / scale
                            });

                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const currentRect = canvasEl.getBoundingClientRect();
                              setCurrentMousePos({
                                x: (moveEvent.clientX - currentRect.left) / scale,
                                y: (moveEvent.clientY - currentRect.top) / scale
                              });
                            };
                            
                            const handleMouseUp = () => {
                              window.removeEventListener('mousemove', handleMouseMove);
                              window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                              setIsConnecting(null);
                              setCurrentMousePos(null);
                            };
                            
                            window.addEventListener('mousemove', handleMouseMove);
                            window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                          }
                        }}
                        ></div>
                      )}

                      {node.type === 'action' && (
                        <>
                          <div 
                            className={cn(
                              "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-green-500/40 rounded-full z-10 cursor-crosshair hover:bg-green-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-green-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Success"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 46;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'success' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Success</span>
                          </div>
                          <div 
                            className={cn(
                              "absolute top-[80px] -right-1.5 h-3 w-3 bg-background border-2 border-yellow-500/40 rounded-full z-10 cursor-crosshair hover:bg-yellow-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-yellow-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Fail Intent"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 86;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'fail_intent' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-yellow-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Fail Intent</span>
                          </div>
                          <div 
                            className={cn(
                              "absolute top-[120px] -right-1.5 h-3 w-3 bg-background border-2 border-red-500/40 rounded-full z-10 cursor-crosshair hover:bg-red-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-red-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="Fails All Intents"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 126;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'fail_all' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none transition-opacity whitespace-nowrap bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>Fails All Intents</span>
                          </div>
                        </>
                      )}

                      {node.type === 'condition' && (
                        <>
                          <div 
                            className={cn(
                              "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-blue-500/40 rounded-full z-10 cursor-crosshair hover:bg-blue-500/20 transition-all duration-200",
                              (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-blue-500 shadow-sm" : "opacity-0 scale-50"
                            )}
                            title="If (True)"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                              const canvasRect = canvasEl?.getBoundingClientRect();
                              if (canvasRect && canvasEl) {
                                const scale = canvasRect.width / canvasEl.offsetWidth;
                                const startX = node.position.x + 280;
                                const startY = node.position.y + 46;
                                setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'true' });
                                setCurrentMousePos({
                                  x: (e.clientX - canvasRect.left) / scale,
                                  y: (e.clientY - canvasRect.top) / scale
                                });

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const currentRect = canvasEl.getBoundingClientRect();
                                  setCurrentMousePos({
                                    x: (moveEvent.clientX - currentRect.left) / scale,
                                    y: (moveEvent.clientY - currentRect.top) / scale
                                  });
                                };
                                
                                const handleMouseUp = () => {
                                  window.removeEventListener('mousemove', handleMouseMove);
                                  window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                  setIsConnecting(null);
                                  setCurrentMousePos(null);
                                };
                                
                                window.addEventListener('mousemove', handleMouseMove);
                                window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                              }
                            }}
                          >
                            <span className={cn(
                              "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-blue-500 pointer-events-none transition-opacity bg-background/80 px-1 py-0.5 rounded",
                              hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                            )}>If</span>
                  </div>
                              <div 
                                className={cn(
                                  "absolute top-[80px] -right-1.5 h-3 w-3 bg-background border-2 border-orange-500/40 rounded-full z-10 cursor-crosshair hover:bg-orange-500/20 transition-all duration-200",
                                  (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-orange-500 shadow-sm" : "opacity-0 scale-50"
                                )}
                                title="Else (False)"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                                  const canvasRect = canvasEl?.getBoundingClientRect();
                                  if (canvasRect && canvasEl) {
                                    const scale = canvasRect.width / canvasEl.offsetWidth;
                                    const startX = node.position.x + 280;
                                    const startY = node.position.y + 86;
                                    setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'false' });
                                    setCurrentMousePos({
                                      x: (e.clientX - canvasRect.left) / scale,
                                      y: (e.clientY - canvasRect.top) / scale
                                    });

                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                      const currentRect = canvasEl.getBoundingClientRect();
                                      setCurrentMousePos({
                                        x: (moveEvent.clientX - currentRect.left) / scale,
                                        y: (moveEvent.clientY - currentRect.top) / scale
                                      });
                                    };
                                    
                                    const handleMouseUp = () => {
                                      window.removeEventListener('mousemove', handleMouseMove);
                                      window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                      setIsConnecting(null);
                                      setCurrentMousePos(null);
                                    };
                                    
                                    window.addEventListener('mousemove', handleMouseMove);
                                    window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                                  }
                                }}
                              >
                                <span className={cn(
                                  "absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-500 pointer-events-none transition-opacity bg-background/80 px-1 py-0.5 rounded",
                                  hoveredNodeId === node.id ? "opacity-100" : "opacity-0"
                                )}>Else</span>
                              </div>
                            </>
                          )}
                          
                          {node.type === 'secret' && (
                            <div 
                              className={cn(
                                "absolute top-[40px] -right-1.5 h-3 w-3 bg-background border-2 border-yellow-500/40 rounded-full z-10 cursor-crosshair hover:bg-yellow-500/20 transition-all duration-200",
                                (hoveredNodeId === node.id || (isConnecting && isConnecting.fromNodeId === node.id)) ? "opacity-100 scale-125 border-yellow-500 shadow-sm" : "opacity-0 scale-50"
                              )}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                const canvasEl = e.currentTarget.closest('.min-w-\\[1000px\\]') as HTMLElement;
                                const canvasRect = canvasEl?.getBoundingClientRect();
                                if (canvasRect && canvasEl) {
                                  const scale = canvasRect.width / canvasEl.offsetWidth;
                                  const startX = node.position.x + 280;
                                  const startY = node.position.y + 46;
                                  setIsConnecting({ fromNodeId: node.id, startX, startY, sourceHandle: 'success' });
                                  setCurrentMousePos({
                                    x: (e.clientX - canvasRect.left) / scale,
                                    y: (e.clientY - canvasRect.top) / scale
                                  });

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const currentRect = canvasEl.getBoundingClientRect();
                                    setCurrentMousePos({
                                      x: (moveEvent.clientX - currentRect.left) / scale,
                                      y: (moveEvent.clientY - currentRect.top) / scale
                                    });
                                  };
                                  
                                  const handleMouseUp = () => {
                                    window.removeEventListener('mousemove', handleMouseMove);
                                    window.removeEventListener('mouseup', handleMouseUp);
                                  window.removeEventListener('click', handleMouseUp as any, { capture: true });
                                    setIsConnecting(null);
                                    setCurrentMousePos(null);
                                  };
                                  
                                  window.addEventListener('mousemove', handleMouseMove);
                                  window.addEventListener('mouseup', handleMouseUp);
                                window.addEventListener('click', handleMouseUp as any, { capture: true, once: true });
                                }
                              }}
                            >
                            </div>

                          )}
  </>
}
