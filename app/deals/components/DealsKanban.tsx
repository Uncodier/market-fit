"use client"

import { Deal, DEAL_STAGES, STAGE_STYLES } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Building, Calendar, DollarSign, Clock } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"

interface DealsKanbanProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  onUpdateDealStage: (dealId: string, newStage: string) => void
}

export function DealsKanban({ deals, onDealClick, onUpdateDealStage }: DealsKanbanProps) {
  const { t } = useLocalization()
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date"
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const formatTaskDate = (dateString: string | null) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    const now = new Date()
    const isThisYear = date.getFullYear() === now.getFullYear()
    const isThisMonth = isThisYear && date.getMonth() === now.getMonth()
    
    if (isThisMonth) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } else if (isThisYear) {
      return date.toLocaleDateString(undefined, { month: 'short' })
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    }
  }

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    onUpdateDealStage(draggableId, destination.droppableId)
  }

  const stageBorderColors: Record<string, string> = {
    prospecting: "border-b-blue-500 dark:border-b-blue-600",
    qualification: "border-b-indigo-500 dark:border-b-indigo-600",
    proposal: "border-b-purple-500 dark:border-b-purple-600",
    negotiation: "border-b-yellow-500 dark:border-b-yellow-600",
    closed_won: "border-b-emerald-500 dark:border-b-emerald-600",
    closed_lost: "border-b-rose-500 dark:border-b-rose-600",
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="overflow-x-auto pb-4 -mx-8">
        <div className="flex gap-4 min-w-fit px-16 min-h-[calc(100vh-220px)] items-stretch">
          {DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter(deal => deal.stage === stage.id)
            const totalAmount = stageDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0)
            
            return (
              <div key={stage.id} className="flex-shrink-0 w-80 flex flex-col">
                <div 
                  className={cn(
                    "bg-background/80 backdrop-blur-sm rounded-t-lg p-3.5 border-b-[3px] border-x border-t shadow-sm sticky top-0 z-10",
                    stageBorderColors[stage.id] || "border-b-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-foreground/80 flex items-center gap-2">
                      {stage.name}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-medium bg-secondary/50">
                      {stageDeals.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {formatCurrency(totalAmount)}
                  </p>
                </div>

                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "bg-muted/30 rounded-b-lg p-3 border-b border-x flex-1 flex flex-col min-h-[150px] transition-colors",
                        snapshot.isDraggingOver && "bg-muted/60 border-primary/20 shadow-inner"
                      )}
                    >
                      {stageDeals.length > 0 ? (
                        stageDeals.map((deal, index) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <Card 
                                  className={cn(
                                    "mb-3 cursor-pointer transition-all duration-200 border-border/60 hover:border-primary/40 relative group",
                                    snapshot.isDragging ? "shadow-lg border-primary/50" : "shadow-sm hover:shadow-md"
                                  )}
                                  onClick={() => onDealClick(deal)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex flex-col gap-1.5">
                                      {/* Title & Amount & Company */}
                                      <div>
                                        <div className="flex justify-between items-start mb-1.5 gap-2">
                                          <h3 className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                                            {deal.name}
                                          </h3>
                                          <span className="font-semibold text-[13px] text-foreground flex-shrink-0 mt-0.5">
                                            {formatCurrency(deal.amount, deal.currency)}
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-2 min-h-8">
                                          {deal.contacts && deal.contacts.length > 0 ? (
                                            <div className="flex -space-x-2">
                                              {deal.contacts.slice(0, 3).map((contact, i) => (
                                                <Avatar key={contact.id || i} className="h-8 w-8 border-2 border-background shadow-sm relative z-10">
                                                  <AvatarFallback className="text-[11px] font-medium bg-primary/10 text-primary" title={contact.lead?.name || (t('deals.kanban.unknown') || "Unknown")}>
                                                    {(contact.lead?.name || contact.lead?.email || "U").substring(0, 2).toUpperCase()}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ))}
                                              {deal.contacts.length > 3 && (
                                                <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[11px] font-medium text-muted-foreground shadow-sm relative z-20">
                                                  +{deal.contacts.length - 3}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <Building className="h-4 w-4 flex-shrink-0 text-muted-foreground/70" />
                                          )}
                                          <span className="truncate text-sm">{deal.companies?.name || deal.company?.name || (t('deals.kanban.noCompany') || "No company")}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Footer: Date, Next Activity & Owner */}
                                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/40">
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center text-[11px] text-muted-foreground font-medium">
                                            {deal.expected_close_date ? (
                                              <>
                                                <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
                                                {formatDate(deal.expected_close_date)}
                                              </>
                                            ) : (
                                              <span className="opacity-60 text-muted-foreground/70">{t('deals.kanban.noCloseDate') || 'No close date'}</span>
                                            )}
                                          </div>
                                          
                                          {/* Next Activity */}
                                          <div 
                                            className={cn(
                                              "flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded border max-w-[130px]",
                                              deal.next_task 
                                                ? "text-muted-foreground bg-muted/20 border-border/60 hover:bg-muted/40 transition-colors" 
                                                : "text-muted-foreground/60 bg-transparent border-transparent"
                                            )} 
                                            title={deal.next_task ? `${t('deals.kanban.nextActivity') || 'Next activity:'} ${deal.next_task.title}${deal.next_task.scheduled_date ? ` ${t('deals.kanban.on') || 'on'} ${formatTaskDate(deal.next_task.scheduled_date)}` : ''}` : `${t('deals.kanban.nextActivity') || 'Next activity:'} ${t('deals.kanban.notScheduled') || 'Not scheduled'}`}
                                          >
                                            <Clock size={10} className={cn("flex-shrink-0", deal.next_task ? "text-primary/60" : "text-muted-foreground/40")} />
                                            {deal.next_task ? (
                                              <span className="truncate flex items-center gap-1">
                                                <span className="truncate max-w-[65px] font-medium">{deal.next_task.title}</span>
                                                {deal.next_task.scheduled_date && (
                                                  <span className="flex-shrink-0 opacity-70 border-l border-border/50 pl-1">
                                                    {formatTaskDate(deal.next_task.scheduled_date)}
                                                  </span>
                                                )}
                                              </span>
                                            ) : (
                                              <span className="truncate">Not scheduled</span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center flex-shrink-0">
                                          {/* Owner Avatar */}
                                          {deal.owners && deal.owners.length > 0 && deal.owners[0].user && (
                                            <Avatar className="h-8 w-8 border-2 border-background shadow-sm relative z-20">
                                              <AvatarFallback className="text-[11px] font-medium bg-muted/80 text-foreground" title={deal.owners[0].user.name || deal.owners[0].user.email}>
                                                {(deal.owners[0].user.name || deal.owners[0].user.email).substring(0, 2).toUpperCase()}
                                              </AvatarFallback>
                                            </Avatar>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))
                      ) : (
                        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                          No deals
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </div>
    </DragDropContext>
  )
}
