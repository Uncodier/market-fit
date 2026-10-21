import Image from "next/image"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Pause, Play, MicroPause, MicroPlay, Plus, MoreHorizontal } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"

import { InstanceTabMenu } from "@/app/components/robots/InstanceTabMenu"

import { createClient } from "@/lib/supabase/client"

import { sortRobotInstances, splitVisibleInstances } from "@/lib/navigation/robots-instance"

import { cn } from "@/lib/utils"

import type { useWorkspaceTabs } from "./use-workspace-tabs"

export function InstanceHeader(input: ReturnType<typeof useWorkspaceTabs>) {
  const { currentSite, siteChangeKey, tabsContainerRef, selectedInstanceId, handleTabChange, tabsListRef, tabInstances, isLoadingRobots, maxVisibleTabs, deletingInstanceIds, viewMode, instanceStats, instanceAvatars, setLocalSelectedInstanceId, refreshRobots, lastTabSelectionTimeRef, setEditingInstanceId, setEditingName, setIsEditModalOpen, handleArchiveInstance, setInstanceToDelete, setIsDeleteModalOpen, setIsBrowserModalOpen, handleCreateNewInstance } = input
  return (<>
      <StickyHeader key={`${currentSite?.id}-${siteChangeKey}`} className="flex-none transition-all duration-300">
        <div className="pt-0 w-full overflow-hidden">
          <div className="flex items-center gap-4 w-full">
            <div className="flex items-center w-full min-w-0" ref={tabsContainerRef}>
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                <Tabs key={`tabs-${currentSite?.id}-${siteChangeKey}`} value={selectedInstanceId} onValueChange={handleTabChange} className="flex-1 min-w-0">
                  <TabsList ref={tabsListRef} className="flex flex-nowrap justify-start w-full overflow-hidden">
                    {/* Show New Agent tab if no instances or while loading */}
                    {(tabInstances.length === 0 || isLoadingRobots) && selectedInstanceId === 'new' && (
                      <TabsTrigger value="new">
                        <span className="flex items-center gap-2 whitespace-nowrap truncate max-w-[120px]">
                          <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">New Agent</span>
                        </span>
                      </TabsTrigger>
                    )}
                    
                    {/* Show instances with responsive overflow */}
                    {(() => {
                      // Sort instances by updated_at descending (most recently updated first)
                      const sortedInstances = sortRobotInstances(tabInstances)
                      
                      // Calculate how many tabs to show
                      const showNewMakinaTab = (tabInstances.length === 0 || isLoadingRobots) && selectedInstanceId === 'new'
                      // Account for "New Agent" tab in maxVisibleTabs if it's shown
                      const effectiveMaxTabs = showNewMakinaTab ? Math.max(1, maxVisibleTabs - 1) : Math.max(1, maxVisibleTabs)
                      const { visible: visibleInstances, hidden: hiddenInstances } = splitVisibleInstances(
                        sortedInstances,
                        selectedInstanceId,
                        effectiveMaxTabs
                      )
                      const needsOverflow = hiddenInstances.length > 0
                      
                      return (
                        <>
                          {visibleInstances.map((inst) => {
                            const isDeletingInstance = deletingInstanceIds.has(inst.id)
                            const isSelected = selectedInstanceId === inst.id
                            const displayName = inst.requirement_title
                              ? inst.requirement_title
                              : (inst.name || `ag-${inst.id.slice(-4)}`)
                            const hasMultipleNodes = !isSelected && (viewMode === "imprenta" 
                              ? instanceStats[inst.id]?.nodes > 1 
                              : viewMode === "workflow" 
                                ? instanceStats[inst.id]?.workflows > 1 
                                : false)
                            return (
                            <TabsTrigger
                              key={`${inst.id}-${siteChangeKey}`}
                              value={inst.id}
                              className={cn(
                                "group",
                                hasMultipleNodes && "bg-primary/10 hover:bg-primary/20 data-[state=active]:bg-primary/15 transition-colors",
                              )}
                            >
                              <span className="flex items-center gap-2 max-w-[120px]">
                                {(() => {
                                  const status = inst.status;
                                  const isRunning = ['running','active'].includes(status);
                                  const isPaused = ['paused'].includes(status);
                                  const isStarting = ['starting','pending','initializing'].includes(status);
                                  const isError = ['error', 'failed'].includes(status);
                                  
                                  const isActiveState = isRunning || isStarting;
                                  const avatarUrl = instanceAvatars[inst.id];
                                  
                                  const StatusIcon = isRunning ? (
                                    <MicroPlay className="h-1.5 w-1.5 text-green-600" />
                                  ) : isPaused ? (
                                    <MicroPause className="h-1.5 w-1.5 text-yellow-600" />
                                  ) : isStarting ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                                  ) : isError ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                  );
                                  
                                  return (
                                    <span 
                                      className="cursor-pointer hover:opacity-80 flex items-center justify-center w-5 h-5 flex-shrink-0 relative"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                          setLocalSelectedInstanceId(inst.id);
                                          const supabase = createClient();
                                          const newInstanceStatus = isActiveState ? 'paused' : 'running';
                                          
                                          // 1. Update the instance.
                                          await supabase
                                            .from('remote_instances')
                                            .update({ status: newInstanceStatus, updated_at: new Date().toISOString() })
                                            .eq('id', inst.id);
                                            
                                          // 2. Update the plans.
                                          if (isActiveState) {
                                            const { data: plans } = await supabase
                                              .from('instance_plans')
                                              .select('id')
                                              .eq('instance_id', inst.id)
                                              .in('status', ['in_progress', 'pending']);
                                            if (plans && plans.length > 0) {
                                              await supabase
                                                .from('instance_plans')
                                                .update({ status: 'paused', updated_at: new Date().toISOString() })
                                                .in('id', plans.map((p: { id: string }) => p.id));
                                            }
                                          } else {
                                            const { data: plans } = await supabase
                                              .from('instance_plans')
                                              .select('id')
                                              .eq('instance_id', inst.id)
                                              .eq('status', 'paused');
                                            if (plans && plans.length > 0) {
                                              await supabase
                                                .from('instance_plans')
                                                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                                                .in('id', plans.map((p: { id: string }) => p.id));
                                            }
                                          }
                                          refreshRobots(currentSite?.id);
                                        } catch (err) {
                                          console.error('Error toggling state from tab icon:', err);
                                        }
                                      }}
                                      title={isActiveState ? "Pause instance and plan" : "Resume instance and plan"}
                                    >
                                      {avatarUrl ? (
                                        <div className="relative w-full h-full flex-shrink-0">
                                          <Image
                                            src={avatarUrl} 
                                            alt="avatar" 
                                            width={20}
                                            height={20}
                                            sizes="20px"
                                            className="w-full h-full object-cover rounded-full border border-border/50 shadow-sm"
                                          />
                                          <div className="absolute -bottom-0.5 -right-0.5 bg-background rounded-full p-[1px] shadow-sm flex items-center justify-center">
                                            {StatusIcon}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-full h-full rounded-full flex items-center justify-center bg-muted/50 border border-border/50">
                                          {isRunning ? (
                                            <Play className="h-2.5 w-2.5 text-green-600" />
                                          ) : isPaused ? (
                                            <Pause className="h-2.5 w-2.5 text-yellow-600" />
                                          ) : isStarting ? (
                                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                          ) : isError ? (
                                            <span className="w-2 h-2 rounded-full bg-red-500" />
                                          ) : (
                                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                                          )}
                                        </div>
                                      )}
                                    </span>
                                  );
                                })()}
                                    <span 
                                      className={cn(
                                        "truncate transition-colors",
                                        selectedInstanceId === inst.id && !inst.requirement_title 
                                          ? "hover:text-primary cursor-text decoration-primary/30 hover:underline underline-offset-4" 
                                          : ""
                                      )}
                                      onClick={(e) => {
                                        const lastSelectedAt = lastTabSelectionTimeRef.current[inst.id] || 0
                                        if (Date.now() - lastSelectedAt < 400) {
                                          return // Ignore click if the tab was just selected
                                        }

                                        if (selectedInstanceId === inst.id && !inst.requirement_title) {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setEditingInstanceId(inst.id)
                                          setEditingName(inst.name || `ag-${inst.id.slice(-4)}`)
                                          setIsEditModalOpen(true)
                                        }
                                      }}
                                    >
                                      {displayName}
                                    </span>
                                <InstanceTabMenu
                                  instanceName={displayName}
                                  isDeleting={isDeletingInstance}
                                  canRename={!inst.requirement_title}
                                  onOpen={() => handleTabChange(inst.id)}
                                  onRename={() => {
                                    setEditingInstanceId(inst.id)
                                    setEditingName(displayName)
                                    setIsEditModalOpen(true)
                                  }}
                                  onArchive={() => {
                                    void handleArchiveInstance({ id: inst.id, name: displayName })
                                  }}
                                  onDelete={() => {
                                    setInstanceToDelete({ id: inst.id, name: displayName })
                                    setIsDeleteModalOpen(true)
                                  }}
                                />
                              </span>
                            </TabsTrigger>
                            )
                          })}
                          {selectedInstanceId !== 'new' &&
                            !visibleInstances.some((inst) => inst.id === selectedInstanceId) && (
                            <TabsTrigger value={selectedInstanceId} className="sr-only" tabIndex={-1}>
                              <span>{selectedInstanceId}</span>
                            </TabsTrigger>
                          )}
                          
                          {/* Show "..." button when there are hidden tabs */}
                          {needsOverflow && hiddenInstances.length > 0 && (
                            <button
                              type="button"
                              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50"
                              onClick={(e) => {
                                e.preventDefault()
                                setIsBrowserModalOpen(true)
                              }}
                            >
                              <span className="flex items-center">
                                <div className="flex -space-x-2 mr-2">
                                  {hiddenInstances.slice(0, 3).map((inst, i) => {
                                    const avatarUrl = instanceAvatars[inst.id];
                                    const name = inst.requirement_title ? inst.requirement_title : (inst.name || `ag-${inst.id.slice(-4)}`);
                                    return (
                                      <div key={inst.id} className="relative z-[1] w-5 h-5 rounded-full border border-background bg-muted flex items-center justify-center overflow-hidden" style={{ zIndex: 3 - i }}>
                                        {avatarUrl ? (
                                          <Image src={avatarUrl} alt="" width={20} height={20} sizes="20px" className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[9px] font-medium text-muted-foreground uppercase">{name.charAt(0)}</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                                <span className="flex items-center gap-1">
                                  <MoreHorizontal className="h-3 w-3" />
                                  <span>{hiddenInstances.length}</span>
                                </span>
                              </span>
                            </button>
                          )}
                        </>
                      )
                    })()}
                  </TabsList>
                </Tabs>
                
                {/* Create a new instance next to the tabs. */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full"
                  onClick={handleCreateNewInstance}
                  title="Create new agent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StickyHeader>
  </>)
}
