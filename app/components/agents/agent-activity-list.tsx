import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Badge } from "@/app/components/ui/badge"
import { AgentActivityItem } from "./agent-activity-item"
import { ActivityExecutionStatus } from "@/app/hooks/use-activity-execution"

interface AgentActivityListProps {
  agent: Agent,
  onExecute: (agent: Agent, activity: AgentActivity) => void,
  viewMode?: "vertical" | "horizontal",
  hideTitle?: boolean,
  activityStates?: Record<string, ActivityExecutionStatus>
}

export function AgentActivityList({
  agent,
  onExecute,
  viewMode = "vertical",
  hideTitle = false,
  activityStates = {}
}: AgentActivityListProps) {
  if (!agent.activities || agent.activities.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No activities available for this agent</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-2",
      viewMode === "horizontal" ? "max-w-[500px] p-0" : "w-full p-4 space-y-4"
    )}>
      {!hideTitle && (
        <div className="flex items-center justify-between px-3 pt-1.5">
          <h3 className={cn(
            "font-semibold",
            viewMode === "horizontal" ? "text-base" : "text-lg"
          )}>
            {viewMode === "horizontal" ? "Activities" : "Agent Activities"}
          </h3>
          
          {viewMode === "horizontal" && (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              {agent.activities.length} activities
            </Badge>
          )}
        </div>
      )}
      
      <div className={cn(
        "overflow-hidden",
        viewMode === "horizontal" ? "" : "border rounded-md"
      )}>
        <div className={cn(
          "px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground",
          viewMode === "horizontal" ? "bg-card/70 border-y" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <span className="w-8">#</span>
            <span>Activity</span>
          </div>
        </div>
        
        <div className={cn(
          "divide-y divide-border max-h-[300px] overflow-y-auto",
          viewMode === "horizontal" && "divide-border/50"
        )}>
          {agent.activities.map((activity: AgentActivity) => (
            <AgentActivityItem 
              key={activity.id} 
              activity={activity} 
              onExecute={(activity) => onExecute(agent, activity)}
              viewMode={viewMode}
              executionStatus={activityStates[activity.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
} 