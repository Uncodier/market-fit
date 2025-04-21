import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Pencil, PlayCircle, ChevronUp, ChevronDown } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { agentStatusVariants, metricItemVariants } from "./agent-card.styles"
import { Skeleton } from "@/app/components/ui/skeleton"

// Extender el tipo Agent para incluir datos personalizados
interface ExtendedAgent extends Agent {
  dbData?: {
    id: string;
    name: string;
    description: string;
    status: string;
    type: string;
    conversations: number;
    successRate: number;
    lastActive: string;
    role: string;
  };
  isDisabled?: boolean;
}

interface GridAgentRowProps {
  agent: ExtendedAgent
  isExpanded: boolean
  onToggleExpand: (agent: ExtendedAgent) => void
  onManage: (agent: ExtendedAgent) => void
  onChat: (agent: ExtendedAgent) => void
  onExecuteActivity: (agent: ExtendedAgent, activity: AgentActivity) => void
  setSelectedAgent?: (agent: ExtendedAgent | null) => void
  forceShow?: boolean
}

export function GridAgentRowSkeleton() {
  return (
    <div className="rounded-lg border shadow-sm overflow-hidden mb-4">
      <div className="flex items-center p-4 bg-background">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        
        <div className="flex items-center gap-6 mx-4">
          <div className="w-24 text-center">
            <Skeleton className="w-24 h-5 mx-auto" />
          </div>
          <div className="w-28 text-center">
            <Skeleton className="w-28 h-5 mx-auto" />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function GridAgentRow({
  agent,
  isExpanded,
  onToggleExpand,
  onManage,
  onChat,
  onExecuteActivity,
  setSelectedAgent,
  forceShow = false
}: GridAgentRowProps) {
  // Si el agente está marcado como deshabilitado y no estamos forzando a mostrarlo, no renderizarlo
  if (agent.isDisabled && !forceShow) {
    console.log(`GridAgentRow: Ocultando agente ${agent.name} (${agent.id}) porque isDisabled=true`);
    return null;
  }
  
  // Determinar qué datos mostrar (DB o template)
  const hasCustomData = !!agent.dbData;
  
  // Get the icon component for the agent
  const getIconComponent = (iconName: string) => {
    // @ts-ignore - Icons is an object that contains all the icons
    return Icons[iconName] || Icons.User;
  };
  
  // Get the icon component
  const IconComponent = getIconComponent(agent.icon);
  
  // Determinar nombre, rol y descripción a mostrar
  const displayName = hasCustomData ? agent.dbData!.name : agent.name;
  const displayDescription = hasCustomData ? agent.dbData!.description : agent.description;
  const displayStatus = hasCustomData ? agent.dbData!.status : "inactive";
  const displayRole = hasCustomData ? agent.dbData!.role : (agent.role || agent.name);
  const displayType = hasCustomData ? agent.dbData!.type : agent.type;
  const displayLastActive = hasCustomData ? agent.dbData!.lastActive : agent.lastActive;
  
  // Determinar si mostrar el rol separadamente (si el nombre es diferente al rol)
  const shouldShowRole = hasCustomData && displayName !== displayRole;
  
  // Determinar si el botón de chat debe estar deshabilitado
  const isChatDisabled = !hasCustomData;
  
  // Format date consistently
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(displayLastActive));

  return (
    <div className={cn(
      "rounded-lg border shadow-sm overflow-hidden mb-4 transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]",
      hasCustomData && "border-primary/30" // Highlight personalized agents
    )}>
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
              alt={`${displayName}'s avatar`} 
            />
            <AvatarFallback className="bg-primary/5">
              <IconComponent className="h-4 w-4 text-primary" aria-hidden={true} />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center">
              <h4 className="font-medium text-sm truncate">
                {displayName}
              </h4>
              {shouldShowRole && (
                <span className="text-xs font-medium text-primary/70 truncate ml-1.5">
                  ({displayRole})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{displayDescription}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 mx-4">
          <div className="w-24 text-center">
            <span className="text-xs font-medium">{displayType.charAt(0).toUpperCase() + displayType.slice(1)}</span>
          </div>
          <div className="w-28 text-center">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            className={cn(
              "flex-none",
              agentStatusVariants({ status: displayStatus as any })
            )}
            aria-label={`Agent status: ${displayStatus}`}
          >
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </Badge>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={(e) => {
              e.stopPropagation();
              onChat(agent);
            }}
            aria-label={`Chat with ${displayName}`}
            disabled={isChatDisabled}
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
            aria-label={`Manage ${displayName}`}
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
              {agent.activities.map((activity: AgentActivity) => (
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
  )
} 