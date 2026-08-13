import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { 
  Eye, 
  User, 
  Users,
  Plus,
  Search,
  PieChart,
  ShoppingCart,
  ChevronDown,
  ChevronRight
} from "@/app/components/ui/icons"
import { useTasks } from "../context/TasksContext"
import { AddTaskDialog } from "./AddTaskDialog"
import { EditTaskDialog } from "./EditTaskDialog"
import { JourneyTaskCard, JourneyTaskSkeleton } from "./JourneyTaskCard"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/app/components/ui/alert-dialog"

interface JourneyTimelineProps {
  leadId: string
  currentStage?: string
}

export function JourneyTimeline({ leadId, currentStage }: JourneyTimelineProps) {
  const router = useRouter()
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const [taskCommentsCount, setTaskCommentsCount] = useState<Record<string, number>>({})
  const { getTasksGroupedByStage, updateTask, deleteTask, loading } = useTasks()
  
  // Check if we are in deals context
  const isDealContext = typeof window !== 'undefined' && window.location.pathname.includes('/deals/');

  // Get tasks grouped by stage
  const stageGroups = getTasksGroupedByStage(leadId)
  
  React.useEffect(() => {
    const initialExpandedState: Record<string, boolean> = {}
    stageGroups.forEach((group) => {
      initialExpandedState[group.stage] = group.tasks.length > 0
    })
    setExpandedStages(initialExpandedState)
  }, [stageGroups.length])

  // Load comments count for tasks
  React.useEffect(() => {
    const loadCommentsCount = async () => {
      const { createClient } = await import("@/utils/supabase/client")
      const supabase = createClient()
      
      // Get all task IDs
      const allTasks = stageGroups.flatMap(group => group.tasks)
      const taskIds = allTasks.map(task => task.id)
      
      if (taskIds.length === 0) return
      
      try {
        const { data, error } = await supabase
          .from('task_comments')
          .select('task_id')
          .in('task_id', taskIds)
        
        if (error) throw error
        
        // Count comments per task
        const counts: Record<string, number> = {}
        data?.forEach((comment: { task_id: string }) => {
          counts[comment.task_id] = (counts[comment.task_id] || 0) + 1
        })
        
        setTaskCommentsCount(counts)
      } catch (error) {
        console.error('Error loading comments count:', error)
      }
    }
    
    loadCommentsCount()
  }, [leadId]) // Use leadId instead of stageGroups to avoid infinite loop
  
  // Toggle expanded/collapsed state for a stage
  const toggleStageExpanded = (stageId: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }))
  }
  
  // Check if all tasks in a stage are completed
  const areAllTasksCompleted = (stage: string) => {
    const stageGroup = stageGroups.find(group => group.stage === stage);
    if (!stageGroup || stageGroup.tasks.length === 0) return false;
    return stageGroup.tasks.every(task => task.status === "completed");
  };
  
  // Get the appropriate icon for each stage
  const getStageIcon = (stageId: string) => {
    // Check if all tasks in this stage are completed
    const allCompleted = areAllTasksCompleted(stageId);
    // Use green text color when all tasks are completed
    const textColorClass = allCompleted ? "text-green-600" : "text-primary";
    
    switch (stageId) {
      case 'awareness':
        return <Eye className={`h-4 w-4 ${textColorClass}`} />;
      case 'consideration':
        return <Search className={`h-4 w-4 ${textColorClass}`} />;
      case 'decision':
        return <PieChart className={`h-4 w-4 ${textColorClass}`} />;
      case 'purchase':
        return <ShoppingCart className={`h-4 w-4 ${textColorClass}`} />;
      case 'retention':
        return <User className={`h-4 w-4 ${textColorClass}`} />;
      case 'referral':
        return <Users className={`h-4 w-4 ${textColorClass}`} />;
      default:
        return null;
    }
  };
  
  // Get description for each stage
  const getStageDescription = (stageId: string) => {
    switch (stageId) {
      case 'awareness':
        return "First contact and discovery";
      case 'consideration':
        return "Evaluating options and solutions";
      case 'decision':
        return "Making a purchase decision";
      case 'purchase':
        return "Completing the transaction";
      case 'retention':
        return "Ongoing engagement and satisfaction";
      case 'referral':
        return "Advocacy and recommendations";
      default:
        return "";
    }
  };
  
  // Handle marking a task as complete
  const handleMarkComplete = async (taskId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    await updateTask(taskId, { 
      status: "completed", 
      completed_date: new Date().toISOString() 
    })
  }
  
  // Handle task deletion dialog
  const handleDeleteDialogOpen = (taskId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setTaskToDelete(taskId)
    setShowDeleteDialog(true)
  }

  // Handle task deletion confirmation
  const handleDeleteTask = async () => {
    if (!taskToDelete) return
    
    setIsDeleting(true)
    try {
      await deleteTask(taskToDelete)
    } catch (error) {
      console.error("Failed to delete task:", error)
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setTaskToDelete(null)
    }
  }
  
  // Handle editing a task
  const handleEditTask = (task: any, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setEditingTask(task)
    setIsEditTaskOpen(true)
  }

  // Handle task click to navigate to control center
  const handleTaskClick = (task: any) => {
    // Navigate via proper paths based on the context
    router.push(`/control-center/${task.id}`)
  }

  const totalTasks = stageGroups.reduce((sum, group) => sum + group.tasks.length, 0)
  const openAddTask = (stage?: string) => {
    if (stage) sessionStorage.setItem("selectedStage", stage)
    setIsAddTaskOpen(true)
  }

  return (
    <div>
      {!loading && totalTasks === 0 && (
        <div className="flex items-center justify-between gap-3 pb-4 mb-1">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Add the first one to start this journey.
          </p>
          <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => openAddTask(currentStage)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add task
          </Button>
        </div>
      )}

      {stageGroups.map((group) => (
        <div key={group.stage} className="border-b border-border/40 last:border-b-0">
          <div
            className={cn(
              "w-full flex items-center justify-between py-3 text-left cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md",
              currentStage === group.stage && "bg-primary/5"
            )}
            onClick={() => toggleStageExpanded(group.stage)}
          >
            <div className="flex items-center min-w-0">
              <div className={`${areAllTasksCompleted(group.stage) ? "bg-green-100" : "bg-primary/10"} rounded-md w-8 h-8 flex items-center justify-center mr-3 shrink-0`}>
                {getStageIcon(group.stage)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground leading-none">{group.label}</h4>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{group.tasks.length}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{getStageDescription(group.stage)}</p>
              </div>
            </div>
            <div className="flex items-center shrink-0 ml-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 mr-1"
                onClick={(event) => {
                  event.stopPropagation()
                  openAddTask(group.stage)
                }}
                title={`Add task to ${group.label}`}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add task to {group.label}</span>
              </Button>
              {expandedStages[group.stage] ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {expandedStages[group.stage] && (
            <div className="space-y-3 ml-8 relative pb-4">
              <div className="absolute left-[0px] top-0 bottom-0 w-[2px] bg-border/40"></div>
              
              {loading ? (
                <>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <JourneyTaskSkeleton key={index} />
                  ))}
                </>
              ) : group.tasks.length > 0 ? (
                group.tasks.map((task) => (
                  <JourneyTaskCard
                    key={task.id}
                    task={task}
                    commentsCount={taskCommentsCount[task.id]}
                    onOpen={handleTaskClick}
                    onComplete={handleMarkComplete}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteDialogOpen}
                  />
                ))
              ) : (
                <div className="pl-8 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>No tasks in this stage.</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => openAddTask(group.stage)}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      
      {/* Add Task Dialog */}
      <AddTaskDialog
        isOpen={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
        leadId={leadId}
      />
      
      {/* Edit Task Dialog */}
      <EditTaskDialog
        isOpen={isEditTaskOpen}
        onOpenChange={setIsEditTaskOpen}
        task={editingTask}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task 
              and remove it from this {isDealContext ? "deal's" : "lead's"} journey.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTask}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 