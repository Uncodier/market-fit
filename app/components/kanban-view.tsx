"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { ClipboardList, Mail, Search, Loader, CheckCircle2 } from "@/app/components/ui/icons"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"

import { Lead } from "@/app/leads/types"

import { EmptyState } from "@/app/components/ui/empty-state"

import { Skeleton } from "@/app/components/ui/skeleton"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

import { Sparkles, User as UserIcon } from "@/app/components/ui/icons"

// Definimos los tipos de estado de los leads
const LEAD_STATUSES = [
  { id: 'new', name: 'New' },
  { id: 'contacted', name: 'Contacted' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'cold', name: 'Cold' },
  { id: 'converted', name: 'Converted' },
  { id: 'lost', name: 'Lost' },
  { id: 'not_qualified', name: 'Not Qualified' }
]

// Colores para los diferentes estados
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  cold: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  converted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  not_qualified: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
}

// Colores para las etapas del journey
const JOURNEY_STAGE_COLORS: Record<string, string> = {
  awareness: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  consideration: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  decision: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  purchase: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  retention: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  referral: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  not_contacted: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// Interface for filtered view
export interface LeadFilters {
  status: string[]
  segments: string[]
  origin: string[]
  journeyStages: string[]
  searchQuery?: string
}

interface KanbanPaginationState {
  page: number
  hasMore: boolean
  isLoading: boolean
}

interface KanbanViewProps {
  leads: Lead[]
  onUpdateLeadStatus: (leadId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onLeadClick: (lead: Lead) => void
  filters?: LeadFilters
  onOpenFilters?: () => void
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void // Add callback for lead updates
  userData?: Record<string, { name: string, avatar_url: string | null }>
  kanbanPagination?: Record<string, KanbanPaginationState>
  onLoadMore?: (status: string) => void
  totalCounts?: Record<string, number>
}

// Cache de etapas para cada lead

import { useKanbanView } from "./use-kanban-view"
export function KanbanView(props: KanbanViewProps) {
const { userData, kanbanPagination, onLoadMore, totalCounts, user, loadingActions, successActions, assigningLeads, leadJourneyStages, isLoadingJourneyStages, hasMoreLeads, leadsByStatus, getSegmentName, getShortName, getCompanyName, getJourneyStageName, handleLeadResearch, handleLeadFollowUp, handleToggleAssignee, handleDragEnd, handleCardClick, hasNoLeads } = useKanbanView(props)
  return (
      <div className="w-full">
      {hasNoLeads ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12 text-primary" />}
          title="No leads found"
          description="There are no leads matching your current filters or you haven't created any leads yet."
          hint="Try clearing your filters or create a new lead to get started."
        />
      ) : (
        <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-8">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max px-4 md:px-8 pb-4 min-h-[200px] items-stretch after:content-[''] after:w-px after:shrink-0">
              {LEAD_STATUSES.map(status => (
                <div key={status.id} className="flex flex-col h-full min-w-[260px] w-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-sm">{status.name}</h3>
                    <Badge variant="outline">{totalCounts[status.id] !== undefined ? totalCounts[status.id] : leadsByStatus[status.id].length}</Badge>
                  </div>
                  
                  <Droppable droppableId={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 rounded-md p-2 min-h-[200px]",
                          snapshot.isDraggingOver 
                            ? 'bg-gray-100/80 dark:bg-primary/10' 
                            : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                        )}
                      >
                        <div className="space-y-3">
                          {leadsByStatus[status.id].map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "w-[320px] transition-shadow duration-200 hover:shadow-md cursor-pointer",
                                    snapshot.isDragging 
                                      ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                      : ''
                                  )}
                                  onClick={(e) => handleCardClick(e, lead)}
                                >
                                  <CardHeader className="px-3 h-[50px] flex flex-row items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-sm font-medium truncate" title={lead.name}>
                                        {lead.name}
                                      </CardTitle>
                                    </div>
                                    <div className="flex-shrink-0 m-0" style={{ marginBottom: '6px' }}>
                                      {isLoadingJourneyStages ? (
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                      ) : (
                                        <Badge className={`text-xs m-0 ${
                                          JOURNEY_STAGE_COLORS[leadJourneyStages[lead.id] || 'not_contacted']
                                        }`}>
                                          {getJourneyStageName(leadJourneyStages[lead.id] || 'not_contacted')}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <div className="border-t dark:border-white/5 border-black/5 mx-3"></div>
                                  <CardContent className="p-3 pt-2 pb-0">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={lead.email}>
                                      {lead.email}
                                    </div>
                                    {lead.phone && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={lead.phone}>
                                        {lead.phone}
                                      </div>
                                    )}
                                      {getCompanyName(lead) && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={getCompanyName(lead) || ''}>
                                          {getCompanyName(lead)}
                                        </div>
                                      )}
                                    <div className="flex items-center justify-between mt-2 mb-3">
                                      {lead.segment_id && (
                                        <Badge variant="secondary" className="text-xs truncate max-w-[200px]" title={getSegmentName(lead.segment_id)}>
                                          {getSegmentName(lead.segment_id)}
                                        </Badge>
                                      )}
                                    </div>
                                    {/* AI Actions Footer */}
                                    <div className="flex items-center justify-between pt-2 pb-2 border-t dark:border-white/5 border-black/5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 font-medium">AI Actions</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-6 w-6 ${successActions[lead.id] === 'research' ? 'bg-green-100 text-green-700' : ''}`}
                                                disabled={loadingActions[lead.id] === 'research'}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  handleLeadResearch(lead.id)
                                                }}
                                              >
                                                {loadingActions[lead.id] === 'research' ? (
                                                  <Loader className="h-3 w-3" />
                                                ) : successActions[lead.id] === 'research' ? (
                                                  <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                  <Search className="h-3 w-3" />
                                                )}
                                                <span className="sr-only">Lead Research</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Research lead</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-6 w-6 ${successActions[lead.id] === 'followup' ? 'bg-green-100 text-green-700' : ''}`}
                                                disabled={loadingActions[lead.id] === 'followup'}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  handleLeadFollowUp(lead.id)
                                                }}
                                              >
                                                {loadingActions[lead.id] === 'followup' ? (
                                                  <Loader className="h-3 w-3" />
                                                ) : successActions[lead.id] === 'followup' ? (
                                                  <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                  <Mail className="h-3 w-3" />
                                                )}
                                                <span className="sr-only">Lead Follow Up</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Intelligent follow-up</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>

                                        {/* Assignee indicator - always show */}
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              {lead.assignee_id ? (
                                                <button
                                                  className="flex items-center space-x-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                                  disabled={assigningLeads[lead.id]}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    handleToggleAssignee(lead.id)
                                                  }}
                                                >
                                                  {assigningLeads[lead.id] ? (
                                                    <Loader className="h-3 w-3" />
                                                  ) : (
                                                    <UserIcon className="h-3 w-3" />
                                                  )}
                                                  <span className="text-xs font-medium truncate max-w-[120px]">
                                                    {lead.assignee_id === user?.id 
                                                      ? 'You' 
                                                      : getShortName(userData?.[lead.assignee_id]?.name || '')}
                                                  </span>
                                                </button>
                                              ) : (
                                                <button
                                                  className="flex items-center space-x-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                                                  disabled={assigningLeads[lead.id]}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    handleToggleAssignee(lead.id)
                                                  }}
                                                >
                                                  {assigningLeads[lead.id] ? (
                                                    <Loader className="h-3 w-3" />
                                                  ) : (
                                                    <Sparkles className="h-3 w-3" />
                                                  )}
                                                  <span className="text-xs font-medium">AI</span>
                                                </button>
                                              )}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Click to {lead.assignee_id === user?.id 
                                                ? 'assign to AI Team' 
                                                : 'assign to me'}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {/* Load More Button */}
                          {hasMoreLeads(status.id) && onLoadMore && (
                            <div className="flex justify-center mt-2 px-2">
                              <Button
                                variant="outline"
                                onClick={() => onLoadMore(status.id)}
                                disabled={kanbanPagination[status.id]?.isLoading}
                                className="w-full max-w-xs"
                                size="sm"
                              >
                                {kanbanPagination[status.id]?.isLoading ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                                    <span>Loading</span>
                                  </div>
                                ) : "Load More"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  )
} 