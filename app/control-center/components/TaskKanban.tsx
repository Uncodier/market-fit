"use client"

import React from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { Clock, PlayCircle, CheckCircle2, XCircle, Ban, MessageSquare } from "@/app/components/ui/icons"
import { Task } from "@/app/types"
import { createClient } from "@/utils/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"

interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
  comments_count?: number
}

interface TaskKanbanProps {
  tasks: ExtendedTask[]
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>
  onTaskClick: (task: ExtendedTask) => void
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

// Extract numeric part from serial_id
const getSerialNumber = (serialId: string) => {
  if (!serialId) return ""
  // Extract prefix and number parts
  const match = serialId.match(/^([A-Z]+)-(\d+)$/)
  if (match) {
    const prefix = match[1]
    const number = parseInt(match[2], 10).toString()
    return `${prefix}-${number}`
  }
  return serialId
}

export function TaskKanban({ tasks, onUpdateTaskStatus, onTaskClick }: TaskKanbanProps) {
  const { currentSite } = useSite()
  const [localTasks, setLocalTasks] = React.useState(tasks)

  React.useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const tasksByStatus = TASK_STATUSES.reduce((acc, status) => {
    acc[status.id] = localTasks
      .filter(task => task.status === status.id)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0)) // Sort by priority descending
    return acc
  }, {} as Record<string, ExtendedTask[]>)

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
    const sourceStatus = source.droppableId
    const destinationTasks = tasksByStatus[newStatus]
    const draggedTask = localTasks.find(t => t.id === draggableId)
    
    if (!draggedTask || !currentSite) return

    // Calculate new priority based on position
    let newPriority: number
    
    // Check if moving within same column or to different column
    const isMovingWithinColumn = sourceStatus === newStatus
    const sourceIndex = source.index
    const destIndex = destination.index
    
    if (destinationTasks.length === 0) {
      // Empty column, start with a high number
      newPriority = 1000
    } else if (destIndex === 0) {
      // Moving to first position
      newPriority = (destinationTasks[0].priority || 0) + 1
    } else if (destIndex >= destinationTasks.length) {
      // Moving to last position
      newPriority = (destinationTasks[destinationTasks.length - 1].priority || 0) - 1
    } else {
      // Moving between two cards
      if (isMovingWithinColumn) {
        // Within same column: check direction
        if (sourceIndex < destIndex) {
          // Moving down: take priority of the card that will be below (current destIndex)
          newPriority = destinationTasks[destIndex].priority || 0
        } else {
          // Moving up: take priority of the card that will be above (current destIndex - 1)
          newPriority = destinationTasks[destIndex - 1].priority || 0
        }
      } else {
        // Moving to different column: take priority of the card above (destIndex - 1)
        newPriority = destinationTasks[destIndex - 1].priority || 0
      }
    }

    console.log('Moving task:', {
      taskId: draggableId,
      from: source.droppableId,
      to: newStatus,
      sourceIndex,
      destIndex,
      isMovingWithinColumn,
      direction: isMovingWithinColumn ? (sourceIndex < destIndex ? 'down' : 'up') : 'cross-column',
      newPriority
    })

    // Update local state immediately for responsiveness
    setLocalTasks(prevTasks => {
      const updatedTasks = prevTasks.map(task => 
        task.id === draggableId 
          ? { ...task, status: newStatus, priority: newPriority }
          : task
      )
      return updatedTasks
    })

    // Call the database function to reorder priorities
    try {
      const supabase = createClient()
      
      // Call the reorder function
      const { data, error } = await supabase.rpc('reorder_task_priorities', {
        p_task_id: draggableId,
        p_new_position: destIndex + 1, // Convert to 1-based position
        p_status: newStatus,
        p_site_id: currentSite.id
      })

      if (error) {
        console.error('Database error:', error)
        throw error
      }

      console.log('Database response:', data)

      // Show success toast
      toast.success(
        source.droppableId !== newStatus 
          ? `Task moved to ${TASK_STATUSES.find(s => s.id === newStatus)?.name}`
          : "Task reordered successfully"
      )

      // Notify parent to refresh
      await onUpdateTaskStatus(draggableId, newStatus)
    } catch (error) {
      // If server update fails, revert local state
      setLocalTasks(tasks)
      console.error('Failed to update task:', error)
      toast.error("Failed to update task position")
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
                                  <div className="flex items-start justify-between min-w-0">
                                    <div className="flex gap-3 items-start min-w-0 flex-1">
                                      {task.leadName && (
                                        <Avatar className="h-[39px] w-[39px] border border-primary/10 relative z-[1] flex-shrink-0">
                                          <AvatarFallback className="bg-primary/10">
                                            {getLeadInitials(task.leadName)}
                                          </AvatarFallback>
                                        </Avatar>
                                      )}
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <h3 className="text-sm font-medium line-clamp-1 mb-1">{task.title}</h3>
                                        <div className="flex items-center gap-2 min-w-0">
                                          {task.assigneeName && (
                                            <>
                                              <span className="text-xs text-muted-foreground flex-shrink-0">{task.assigneeName}</span>
                                              <span className="text-xs text-muted-foreground flex-shrink-0">•</span>
                                            </>
                                          )}
                                          {task.leadName && (
                                            <>
                                              <span className="text-xs text-muted-foreground truncate flex-grow min-w-0">{task.leadName}</span>
                                              <span className="text-xs text-muted-foreground flex-shrink-0">•</span>
                                            </>
                                          )}
                                          <span className="text-xs text-muted-foreground flex-shrink-0 min-w-[60px] truncate">
                                            {formatDistanceToNow(new Date(task.scheduled_date), { addSuffix: true })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {task.serial_id && (
                                      <div className="font-mono text-xs text-muted-foreground flex-shrink-0 ml-2">
                                        {getSerialNumber(task.serial_id)}
                                      </div>
                                    )}
                                  </div>

                                  <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2 min-h-[0.5rem]">
                                    {task.description || ""}
                                  </p>

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