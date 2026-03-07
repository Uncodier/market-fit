"use client"

import { Deal, DEAL_STAGES, STAGE_STYLES } from "../types"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Building, Calendar, DollarSign } from "@/app/components/ui/icons"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"

interface DealsKanbanProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  onUpdateDealStage: (dealId: string, newStage: string) => void
}

export function DealsKanban({ deals, onDealClick, onUpdateDealStage }: DealsKanbanProps) {
  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return "-"
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No date"
    return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
                                  <CardContent className="p-3.5">
                                    <div className="flex flex-col gap-2">
                                      {/* Title & Company */}
                                      <div>
                                        <h3 className="text-sm font-semibold leading-tight line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
                                          {deal.name}
                                        </h3>
                                        <div className="text-xs text-muted-foreground flex items-center">
                                          <Building className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-muted-foreground/70" />
                                          <span className="truncate">{deal.companies?.name || deal.company?.name || "No company"}</span>
                                        </div>
                                      </div>
                                      
                                      {/* Amount & Badges */}
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="font-semibold text-[13px] text-foreground">
                                          {formatCurrency(deal.amount, deal.currency)}
                                        </span>
                                        
                                        {deal.qualification_score !== null && (
                                          <Badge 
                                            variant="outline" 
                                            className={cn(
                                              "text-[10px] px-1.5 py-0 h-5 font-medium border",
                                              deal.qualification_score >= 80 ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20' : 
                                              deal.qualification_score >= 50 ? 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20' : 
                                              'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20'
                                            )}
                                          >
                                            Score: {deal.qualification_score}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {/* Footer: Date & Owner */}
                                      <div className="flex items-center justify-between mt-1.5 pt-2.5 border-t border-border/40">
                                        <div className="flex items-center text-[11px] text-muted-foreground font-medium">
                                          {deal.expected_close_date ? (
                                            <>
                                              <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
                                              {formatDate(deal.expected_close_date)}
                                            </>
                                          ) : (
                                            <span className="opacity-60 text-muted-foreground/70">No close date</span>
                                          )}
                                        </div>
                                        
                                        {deal.owners && deal.owners.length > 0 && deal.owners[0].user && (
                                          <Avatar className="h-5 w-5 border border-border shadow-sm">
                                            <AvatarFallback className="text-[9px] bg-muted/80 text-foreground">
                                              {(deal.owners[0].user.name || deal.owners[0].user.email).substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
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
