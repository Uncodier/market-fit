import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { 
  Check, 
  Clock, 
  AlertCircle, 
  Eye, 
  FileText, 
  MessageSquare, 
  Tag, 
  User, 
  Users,
  Plus,
  Search,
  PieChart,
  ShoppingCart,
  Mail,
  BarChart,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight
} from "@/app/components/ui/icons"
import { format } from "date-fns"
import { Task, hasAmount } from "@/app/leads/types"
import { useTasks } from "../context/TasksContext"
import { AddTaskDialog } from "./AddTaskDialog"
import { EditTaskDialog } from "./EditTaskDialog"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/app/components/ui/dropdown-menu"
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

// Get badge style for status
function getBadgeStyleForStatus(status: string) {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
    case "in_progress":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200"
    case "failed":
      return "bg-red-100 text-red-800 hover:bg-red-200 border border-red-200"
    case "pending":
    default:
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200"
  }
}

// Helper for status check
function getStatusContent(task: Task) {
  if (task.status === "in_progress") {
    return (
      <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
        <Clock className="h-3 w-3 text-blue-600" />
      </div>
    );
  } else if (task.status === "failed") {
    return (
      <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="h-3 w-3 text-red-600" />
      </div>
    );
  } else if (task.status === "completed") {
    return (
      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="h-3 w-3 text-green-600" />
      </div>
    );
  } else {
    return (
      <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
        <Clock className="h-3 w-3 text-yellow-600" />
      </div>
    );
  }
}

// Task Skeleton Component
function TaskSkeleton() {
  return (
    <div className="relative pl-8">
      {/* Status indicator skeleton */}
      <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      
      {/* Task content skeleton */}
      <div className="bg-muted/40 rounded-lg p-3 border border-border/30">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-2" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-6 w-6" />
          </div>
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  )
}

export function JourneyTimeline({ leadId }: JourneyTimelineProps) {
  const router = useRouter()
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const [taskCommentsCount, setTaskCommentsCount] = useState<Record<string, number>>({})
  const { getTasksGroupedByStage, updateTask, deleteTask, loading } = useTasks()
  
  // Get tasks grouped by stage
  const stageGroups = getTasksGroupedByStage(leadId)
  
  // Initialize expanded stages (all expanded by default)
  React.useEffect(() => {
    const initialExpandedState: Record<string, boolean> = {};
    stageGroups.forEach(group => {
      initialExpandedState[group.stage] = true;
    });
    setExpandedStages(initialExpandedState);
  }, [stageGroups.length]);

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
        data?.forEach(comment => {
          counts[comment.task_id] = (counts[comment.task_id] || 0) + 1
        })
        
        setTaskCommentsCount(counts)
      } catch (error) {
        console.error('Error loading comments count:', error)
      }
    }
    
    loadCommentsCount()
  }, [stageGroups])
  
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
        return <Eye className={`h-5 w-5 ${textColorClass}`} />;
      case 'consideration':
        return <Search className={`h-5 w-5 ${textColorClass}`} />;
      case 'decision':
        return <PieChart className={`h-5 w-5 ${textColorClass}`} />;
      case 'purchase':
        return <ShoppingCart className={`h-5 w-5 ${textColorClass}`} />;
      case 'retention':
        return <User className={`h-5 w-5 ${textColorClass}`} />;
      case 'referral':
        return <Users className={`h-5 w-5 ${textColorClass}`} />;
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
  const handleEditTask = (task: Task, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setEditingTask(task)
    setIsEditTaskOpen(true)
  }

  // Handle task click to navigate to control center
  const handleTaskClick = (task: Task) => {
    router.push(`/control-center/${task.id}`)
  }

  return (
    <div className="space-y-6">
      {/* Stage Groups */}
      {stageGroups.map((group) => (
        <div key={group.stage} className="mb-8 last:mb-0">
          <Card className="mb-4 cursor-pointer border border-border hover:border-foreground/20 transition-colors overflow-hidden" onClick={() => toggleStageExpanded(group.stage)}>
            <CardContent className="p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`${areAllTasksCompleted(group.stage) ? 'bg-green-100' : 'bg-primary/10'} rounded-md w-10 h-10 flex items-center justify-center mr-3`}>
                    {getStageIcon(group.stage)}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-foreground leading-none">{group.label}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{getStageDescription(group.stage)}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-8 w-8 p-0 mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddTaskOpen(true);
                      // Pre-select the stage for the new task
                      if (group.stage) {
                        sessionStorage.setItem('selectedStage', group.stage);
                      }
                    }}
                    title={`Add task to ${group.label}`}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Add task to {group.label}</span>
                  </Button>
                  {expandedStages[group.stage] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {expandedStages[group.stage] && (
            <div className="space-y-4 ml-8 relative">
              {/* Timeline vertical connecting line */}
              <div className="absolute left-[0px] top-0 bottom-0 w-[2px] bg-border/40"></div>
              
              {loading ? (
                // Show loading skeletons while tasks are loading
                <>
                  {Array.from({ length: 2 }).map((_, index) => (
                    <TaskSkeleton key={index} />
                  ))}
                </>
              ) : group.tasks.length > 0 ? (
                group.tasks.map((task) => (
                  <div key={task.id} className="relative pl-8">
                    {/* Status indicator */}
                    <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
                      {getStatusContent(task)}
                    </div>
                    
                    {/* Task content - Now clickable and with hover effects */}
                    <div 
                      className={`bg-muted/40 rounded-lg p-3 border cursor-pointer transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] hover:bg-muted/60 ${
                        task.status === "in_progress" ? "border-blue-200" : "border-border/30"
                      }`}
                      onClick={() => handleTaskClick(task)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2 flex-1">
                          <h4 className="text-sm font-medium">{task.title}</h4>
                          {task.amount && ["quote", "contract", "payment"].includes(task.type) && (
                            <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium inline-flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              ${task.amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Serial ID */}
                          {task.serial_id && (
                            <div className="font-mono text-xs text-muted-foreground">
                              {getSerialNumber(task.serial_id)}
                            </div>
                          )}
                          
                          <Badge className={getBadgeStyleForStatus(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          
                          {/* Completion chip after status with & */}
                          {task.status === "completed" && (
                            <>
                              <span className="text-xs text-muted-foreground">&</span>
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200">
                                Closed
                              </Badge>
                            </>
                          )}
                          
                          {/* Task options menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="sr-only">Open menu</span>
                                {/* Use a Unicode ellipsis character as an icon */}
                                <span className="text-base leading-none">⋮</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {task.status !== "completed" && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkComplete(task.id)
                                }}>
                                  <Check className="mr-2 h-4 w-4" />
                                  Mark Complete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                handleEditTask(task)
                              }}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteDialogOpen(task.id)
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      <div className="mt-3 flex items-center gap-4">
                        {/* Date */}
                        <div className="text-xs text-muted-foreground">
                          {task.scheduled_date && (
                            <div className="inline-flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(task.scheduled_date), "MMM d")} {format(new Date(task.scheduled_date), "yyyy")}
                            </div>
                          )}
                        </div>
                        
                        {/* Comments count */}
                        {taskCommentsCount[task.id] ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{taskCommentsCount[task.id]}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border border-border/30 ml-8">
                  <p className="text-sm text-muted-foreground mb-2">No tasks in this stage</p>
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
              and remove it from this lead's journey.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTask}
              className="bg-red-500 hover:bg-red-600 text-white"
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