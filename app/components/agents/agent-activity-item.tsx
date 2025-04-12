import { cn } from "@/lib/utils"
import { AgentActivity } from "@/app/types/agents"
import { PlayCircle } from "@/app/components/ui/icons"

interface AgentActivityItemProps {
  activity: AgentActivity
  onExecute: (activity: AgentActivity) => void
  viewMode?: "vertical" | "horizontal"
}

export function AgentActivityItem({ 
  activity, 
  onExecute,
  viewMode = "vertical"
}: AgentActivityItemProps) {
  return (
    <div 
      className={cn(
        "group flex items-center justify-between hover:bg-accent/50 rounded-md transition-colors",
        viewMode === "horizontal" ? "px-3 py-2.5" : "px-4 py-3"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 flex items-center justify-center">
          <span className="text-sm font-medium text-muted-foreground group-hover:hidden">
            {activity.id.split('').pop()}
          </span>
          <button 
            onClick={() => onExecute(activity)}
            className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label={`Execute ${activity.name}`}
          >
            <PlayCircle className="h-4 w-4" />
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
          )}>{activity.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <span className={cn(
          "text-muted-foreground whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.estimatedTime}</span>
        <span className={cn(
          "text-foreground font-medium whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.successRate}%</span>
        <span className={cn(
          "text-muted-foreground whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.executions}</span>
      </div>
    </div>
  )
} 