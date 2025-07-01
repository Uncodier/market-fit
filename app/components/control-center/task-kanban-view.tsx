"use client"

import React, { useState } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Task } from "@/lib/validations/task"
import { cn } from "@/lib/utils"

const TASK_STATUSES = [
  { id: "TODO", name: "To Do" },
  { id: "IN_PROGRESS", name: "In Progress" },
  { id: "DONE", name: "Done" },
]

const STATUS_COLORS: Record<string, string> = {
  TODO: "bg-blue-100/20 text-blue-800 dark:bg-blue-900/10 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100/20 text-yellow-800 dark:bg-yellow-900/10 dark:text-yellow-300",
  DONE: "bg-green-100/20 text-green-800 dark:bg-green-900/10 dark:text-green-300",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-blue-100/80 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  MEDIUM: "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  HIGH: "bg-red-100/80 text-red-800 dark:bg-red-900/50 dark:text-red-300",
}

interface TaskKanbanViewProps {
  tasks: Task[]
  onUpdateTaskStatus: (taskId: string, newStatus: string) => Promise<void>
  onTaskClick: (task: Task) => void
}

export function TaskKanbanView({
  tasks,
  onUpdateTaskStatus,
  onTaskClick,
}: TaskKanbanViewProps) {
  const getTasksByStatus = () => {
    const tasksByStatus: Record<string, Task[]> = {}
    TASK_STATUSES.forEach(status => {
      tasksByStatus[status.id] = tasks.filter(task => task.status === status.id)
    })
    return tasksByStatus
  }

  const [tasksByStatus, setTasksByStatus] = useState(getTasksByStatus())

  React.useEffect(() => {
    setTasksByStatus(getTasksByStatus())
  }, [tasks])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return
    }
    
    const task = tasks.find(t => t.id === draggableId)
    if (!task) return
    
    const newTasksByStatus = {...tasksByStatus}
    
    newTasksByStatus[source.droppableId] = newTasksByStatus[source.droppableId].filter(
      t => t.id !== draggableId
    )
    
    const updatedTask = {...task, status: destination.droppableId as Task["status"]}
    
    newTasksByStatus[destination.droppableId] = [
      ...newTasksByStatus[destination.droppableId].slice(0, destination.index),
      updatedTask,
      ...newTasksByStatus[destination.droppableId].slice(destination.index)
    ]
    
    setTasksByStatus(newTasksByStatus)
    
    try {
      await onUpdateTaskStatus(draggableId, destination.droppableId)
    } catch (error) {
      console.error("Error updating task status:", error)
      setTasksByStatus(getTasksByStatus())
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks found"
        description="There are no tasks matching your current filters or you haven't created any tasks yet."
        hint="Try clearing your filters or create a new task to get started."
      />
    )
  }

  return (
    <div className="overflow-x-auto pb-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 min-w-fit">
          {TASK_STATUSES.map(status => (
            <div key={status.id} className="flex-shrink-0 w-80">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">{status.name}</h3>
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
                    className="bg-muted/30 rounded-b-md p-2 border-b border-x min-h-[150px]"
                  >
                    {tasksByStatus[status.id]?.map((task, index) => (
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
                                STATUS_COLORS[task.status]
                              )}
                              onClick={() => onTaskClick(task)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                  <h3 className="text-sm font-medium line-clamp-1">{task.title}</h3>
                                  <Badge className={PRIORITY_COLORS[task.priority]}>
                                    {task.priority}
                                  </Badge>
                                </div>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                {task.scheduledDate && (
                                  <div className="flex items-center justify-end mt-2">
                                    <Badge variant="secondary" className="text-xs bg-muted/80 dark:bg-muted/50">
                                      Due: {new Date(task.scheduledDate).toLocaleDateString()}
                                    </Badge>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
} 