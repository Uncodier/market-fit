import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Pencil, PlayCircle, ChevronUp, ChevronDown } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { agentStatusVariants, metricItemVariants } from "./agent-card.styles"
import { AgentActivityItem } from "./agent-activity-item"

interface GridAgentRowProps {
  agent: Agent
  isExpanded: boolean
  onToggleExpand: (agent: Agent) => void
  onManage: (agent: Agent) => void
  onChat: (agent: Agent) => void
  onExecuteActivity: (agent: Agent, activity: AgentActivity) => void
  setSelectedAgent?: (agent: Agent | null) => void
}

export function GridAgentRow({
  agent,
  isExpanded,
  onToggleExpand,
  onManage,
  onChat,
  onExecuteActivity,
  setSelectedAgent
}: GridAgentRowProps) {
  // Get the icon component for the agent
  const getIconComponent = (iconName: string) => {
    // @ts-ignore - Icons is an object that contains all the icons
    return Icons[iconName] || Icons.User;
  };
  
  // Get the icon component
  const IconComponent = getIconComponent(agent.icon);
  
  // Format date consistently
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(agent.lastActive));

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden mb-4 transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]">
      {/* Agent Row */}
      <div 
        className={cn(
          "flex items-center p-4 bg-background transition-colors cursor-pointer",
          isExpanded ? "border-b border-border" : "hover:bg-accent/10"
        )}
        onClick={() => {
          onToggleExpand(agent);
          if (setSelectedAgent) {
            setSelectedAgent(agent);
          }
        }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 ring-1 ring-border shadow-sm">
            <AvatarImage 
              src={`/avatars/agent-${agent.id}.png`} 
              alt={`${agent.name}'s avatar`} 
            />
            <AvatarFallback className="bg-primary/5">
              <IconComponent className="h-4 w-4 text-primary" aria-hidden={true} />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{agent.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 mx-4">
          <div className="w-24 text-center">
            <span className="text-xs font-medium">{agent.type.charAt(0).toUpperCase() + agent.type.slice(1)}</span>
          </div>
          <div className="w-28 text-center">
            <div className={cn(metricItemVariants({ hover: true }), "flex flex-col")}>
              <span className="text-xs font-medium">{agent.conversations}</span>
              <span className="text-xs text-muted-foreground">conversations</span>
            </div>
          </div>
          <div className="w-24 text-center">
            <div className={cn(metricItemVariants({ hover: true }), "flex flex-col")}>
              <span className="text-xs font-medium">{agent.successRate}%</span>
              <span className="text-xs text-muted-foreground">success</span>
            </div>
          </div>
          <div className="w-28 text-center">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            className={cn(
              "flex-none",
              agentStatusVariants({ status: agent.status })
            )}
            aria-label={`Agent status: ${agent.status}`}
          >
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </Badge>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={(e) => {
              e.stopPropagation();
              onChat(agent);
            }}
            aria-label={`Chat with ${agent.name}`}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onManage(agent);
            }}
            aria-label={`Manage ${agent.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Activities Section - Expanded */}
      {isExpanded && agent.activities && agent.activities.length > 0 && (
        <div className="p-4 bg-background/50 border-t border-border/50">
          <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
            <div className="bg-muted/30 px-4 py-2.5 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Agent Activities</h3>
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                {agent.activities.length} activities
              </Badge>
            </div>
            
            <div className="divide-y divide-border/70">
              {agent.activities.map(activity => (
                <div 
                  key={activity.id}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground group-hover:hidden">
                        {activity.id.split('').pop()}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecuteActivity(agent, activity);
                        }}
                        className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        aria-label={`Execute ${activity.name}`}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{activity.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.estimatedTime}</span>
                    <span className="text-xs text-foreground font-medium whitespace-nowrap">{activity.successRate}%</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.executions} runs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 