import React, { useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
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

// Helper function for getting badge style based on status
function getBadgeStyleForStatus(status: "completed" | "in_progress" | "pending" | "failed") {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "in_progress":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "pending":
      return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    case "failed":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    default:
      return "bg-gray-100 text-gray-700 hover:bg-gray-100";
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

export function JourneyTimeline({ leadId }: JourneyTimelineProps) {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({})
  const { getTasksGroupedByStage, updateTask, deleteTask } = useTasks()
  
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
  const handleMarkComplete = async (taskId: string) => {
    await updateTask(taskId, { 
      status: "completed", 
      completed_date: new Date().toISOString() 
    })
  }
  
  // Handle task deletion dialog
  const handleDeleteDialogOpen = (taskId: string) => {
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
  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setIsEditTaskOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Stage Groups */}
      {stageGroups.map((group) => (
        <div key={group.stage} className="mb-8 last:mb-0">
          <Card className="mb-4 cursor-pointer" onClick={() => toggleStageExpanded(group.stage)}>
            <CardContent className="p-3">
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
              
              {group.tasks.length > 0 ? (
                group.tasks.map((task) => (
                  <div key={task.id} className="relative pl-8">
                    {/* Status indicator */}
                    <div className="absolute left-[-10px] top-3 bg-background rounded-full p-[2px]">
                      {getStatusContent(task)}
                    </div>
                    
                    {/* Task content */}
                    <div className={`bg-muted/40 rounded-lg p-3 border ${
                      task.status === "in_progress" ? "border-blue-200" : "border-border/30"
                    }`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{task.title}</h4>
                          {task.amount && ["quote", "contract", "payment"].includes(task.type) && (
                            <div className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-medium inline-flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              ${task.amount.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className={getBadgeStyleForStatus(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                          
                          {/* Task options menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <span className="sr-only">Open menu</span>
                                {/* Use a Unicode ellipsis character as an icon */}
                                <span className="text-base leading-none">⋮</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {task.status !== "completed" && (
                                <DropdownMenuItem onClick={() => handleMarkComplete(task.id)}>
                                  <Check className="mr-2 h-4 w-4" />
                                  Mark Complete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteDialogOpen(task.id)}
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
                      <div className="mt-3 flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          {task.scheduled_date && (
                            <div className="inline-flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(task.scheduled_date), "MMM d, yyyy")}
                            </div>
                          )}
                        </div>
                        
                        {/* Complete button for pending tasks */}
                        {(task.status === "pending" || task.status === "in_progress") && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 text-xs bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                            onClick={() => handleMarkComplete(task.id)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
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