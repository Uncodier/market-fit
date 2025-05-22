"use client"

import React from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Clock, PlayCircle, CheckCircle2, XCircle, Ban, MessageSquare } from "@/app/components/ui/icons"

interface Task {
  id: string
  title: string
  description: string | null
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'canceled'
  stage?: 'awareness' | 'consideration' | 'decision' | 'purchase' | 'retention' | 'referral'
  scheduled_date: string
  lead_id?: string
  assignee?: string
  leadName?: string
  assigneeName?: string
  comments_count?: number
}

interface TaskKanbanProps {
  tasks: Task[]
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>
  onTaskClick: (task: Task) => void
}

// Define task statuses
const TASK_STATUSES = [
  { id: "pending", name: "Pending", icon: <Clock className="h-4 w-4" /> },
  { id: "in_progress", name: "In Progress", icon: <PlayCircle className="h-4 w-4" /> },
  { id: "completed", name: "Completed", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "failed", name: "Failed", icon: <XCircle className="h-4 w-4" /> },
  { id: "canceled", name: "Canceled", icon: <Ban className="h-4 w-4" /> }
]

// Status styles
const STATUS_STYLES = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  canceled: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20"
}

// Stage styles
const STAGE_STYLES = {
  awareness: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  consideration: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  decision: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  purchase: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  retention: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  referral: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20"
}

// Get stage display name
const getStageDisplayName = (stage?: string) => {
  if (!stage) return "-"
  return stage.charAt(0).toUpperCase() + stage.slice(1)
}

// Get lead initials
const getLeadInitials = (name: string | undefined) => {
  if (!name) return "L"
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}

export function TaskKanban({ tasks, onUpdateTaskStatus, onTaskClick }: TaskKanbanProps) {
  // Group tasks by status
  const [localTasks, setLocalTasks] = React.useState(tasks)

  React.useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status.id] = localTasks.filter(task => task.status === status.id)
    return acc
  }, {} as Record<string, Task[]>)

  // Handle drag end
  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newStatus = destination.droppableId
    
    // Update local state immediately
    setLocalTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === draggableId 
          ? { ...task, status: newStatus }
          : task
      )
    )

    // Then update server state
    try {
      await onUpdateTaskStatus(draggableId, newStatus)
    } catch (error) {
      // If server update fails, revert local state
      setLocalTasks(tasks)
      console.error('Failed to update task status:', error)
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-fit">
          {TASK_STATUSES.map(status => (
            <div key={status.id} className="flex-shrink-0 w-80">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status.icon}
                    <h3 className="font-medium text-sm">{status.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tasksByStatus[status.id]?.length || 0}
                  </Badge>
                </div>
              </div>
              <Droppable droppableId={status.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="bg-muted/30 rounded-b-md p-2 border-b border-x"
                  >
                    {tasksByStatus[status.id]?.length > 0 ? (
                      tasksByStatus[status.id].map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <Card
                                className={cn(
                                  "mb-2 cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]",
                                  snapshot.isDragging && "shadow-lg"
                                )}
                                onClick={() => onTaskClick(task)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex gap-3 items-start">
                                      {task.leadName && (
                                        <Avatar className="h-[39px] w-[39px] border border-primary/10 relative z-[1]">
                                          <AvatarFallback className="bg-primary/10">
                                            {getLeadInitials(task.leadName)}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <div className="flex flex-col">
                                        <h3 className="text-sm font-medium line-clamp-1 mt-0.5">{task.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                          {task.assigneeName && (
                                            <>
                                              <span className="text-xs text-muted-foreground">{task.assigneeName}</span>
                                              <span className="text-xs text-muted-foreground">•</span>
                                            </>
                                          )}
                                          <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(task.scheduled_date), { addSuffix: true })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2">{task.description}</p>
                                  )}

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {task.stage && (
                                      <Badge 
                                        variant="outline" 
                                        className={STAGE_STYLES[task.stage]}
                                      >
                                        {getStageDisplayName(task.stage)}
                                      </Badge>
                                    )}
                                    {task.comments_count ? (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>{task.comments_count}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        No tasks found
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  )
} 