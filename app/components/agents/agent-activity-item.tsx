import { cn } from "@/lib/utils"
import { AgentActivity } from "@/app/types/agents"
import { PlayCircle, Loader, CheckCircle2, XCircle, Ban } from "@/app/components/ui/icons"
import { ActivityExecutionStatus } from "@/app/hooks/use-activity-execution"
import { useEffect, useState } from "react"

interface AgentActivityItemProps {
  activity: AgentActivity
  onExecute: (activity: AgentActivity) => void
  viewMode?: "vertical" | "horizontal"
  executionStatus?: ActivityExecutionStatus
  isDisabled?: boolean
}

export function AgentActivityItem({ 
  activity, 
  onExecute,
  viewMode = "vertical",
  executionStatus = { state: 'idle' },
  isDisabled = false
}: AgentActivityItemProps) {
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)

  // Handle success state animation
  useEffect(() => {
    if (executionStatus.state === 'success') {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 3000) // Hide after 3 seconds
      return () => clearTimeout(timer)
    }
  }, [executionStatus.state])

  // Handle error state animation
  useEffect(() => {
    if (executionStatus.state === 'error') {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), 5000) // Hide after 5 seconds
      return () => clearTimeout(timer)
    }
  }, [executionStatus.state])

  const isExecuting = executionStatus.state === 'loading'
  const isSuccessful = executionStatus.state === 'success' || showSuccess
  const hasError = executionStatus.state === 'error' || showError

  // Determine if this activity should be clickable
  const isSyncEmailsActivity = activity.id === "cs4" && activity.name === "Answer Emails"
  const isAnalyzeSegmentsActivity = activity.id === "mk4" && activity.name === "Analyze Segments"
  const isCreateCampaignActivity = activity.id === "mk1" && activity.name === "Create Marketing Campaign"
  const isContentCalendarActivity = activity.id === "ct1" && activity.name === "Content Calendar Creation"
  const isDailyStandUpActivity = activity.id === "gl6" && activity.name === "Daily Stand Up"
  const isLeadGenerationActivity = activity.id === "sl3" && activity.name === "Lead Generation"
  const isClickable = !isDisabled && (isSyncEmailsActivity || isAnalyzeSegmentsActivity || isCreateCampaignActivity || isContentCalendarActivity || isDailyStandUpActivity || isLeadGenerationActivity)

  const getButtonContent = () => {
    if (isExecuting) {
      return <Loader className="h-4 w-4 animate-spin" />
    }
    if (isSuccessful) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    }
    if (hasError) {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
    if (!isClickable) {
      return <Ban className="h-4 w-4 text-muted-foreground/50" />
    }
    return <PlayCircle className="h-4 w-4" />
  }

  const getButtonClassName = () => {
    if (isExecuting) {
      return "bg-blue-500 text-white hover:bg-blue-600"
    }
    if (isSuccessful) {
      return "bg-green-100 text-green-600 hover:bg-green-200"
    }
    if (hasError) {
      return "bg-red-100 text-red-600 hover:bg-red-200"
    }
    if (!isClickable) {
      return "bg-muted text-muted-foreground/50 cursor-not-allowed"
    }
    return "bg-primary text-primary-foreground hover:bg-primary/90"
  }

  return (
    <div 
      className={cn(
        "group flex items-center justify-between hover:bg-accent/50 rounded-md transition-colors",
        viewMode === "horizontal" ? "px-3 py-2.5" : "px-4 py-3",
        !isClickable && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 flex items-center justify-center">
          <span className={cn(
            "text-sm font-medium text-muted-foreground",
            (isExecuting || isSuccessful || hasError) ? "hidden" : "group-hover:hidden"
          )}>
            {activity.id.split('').pop()}
          </span>
          <button 
            onClick={() => isClickable && !isExecuting ? onExecute(activity) : undefined}
            disabled={!isClickable || isExecuting}
            className={cn(
              "h-7 w-7 items-center justify-center rounded-full shadow-sm transition-all duration-200",
              (isExecuting || isSuccessful || hasError) ? "flex" : "hidden group-hover:flex",
              getButtonClassName()
            )}
            aria-label={
              isExecuting 
                ? `Executing ${activity.name}...` 
                : isSuccessful 
                  ? `${activity.name} completed successfully` 
                  : hasError 
                    ? `${activity.name} failed` 
                    : !isClickable 
                      ? `${activity.name} is not available` 
                      : `Execute ${activity.name}`
            }
          >
            {getButtonContent()}
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-medium truncate",
            viewMode === "horizontal" ? "text-xs" : "text-sm"
          )}>{activity.name}</h4>
          <p className={cn(
            "text-muted-foreground truncate",
            viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
          )}>
            {isExecuting ? "Executing..." : 
             isSuccessful ? (executionStatus.message || "Completed successfully") :
             hasError ? (executionStatus.message || "Execution failed") :
             activity.description}
          </p>
        </div>
      </div>
    </div>
  )
} 