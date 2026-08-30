import React from "react"
import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Pencil, ChevronUp, ChevronDown, Bell, LogIn, LogOut } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { agentStatusVariants } from "./agent-card.styles"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useSite } from "@/app/context/SiteContext"
import { ActivityExecutionStatus } from "@/app/hooks/use-activity-execution"
import { AgentActivityItem } from "./agent-activity-item"
import { getEnabledSiteChannels } from "@/lib/site-channels"
import { ChannelBadge } from "@/app/components/channels/channel-icon"
import { TableCell, TableRow } from "@/app/components/ui/table"
import { DocumentListRow, EntityCell, StatusDot } from "@/app/components/documents/document-list"

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
  activityStates?: Record<string, ActivityExecutionStatus>
}


export function GridAgentRow({
  agent,
  isExpanded,
  onToggleExpand,
  onManage,
  onChat,
  onExecuteActivity,
  setSelectedAgent,
  forceShow = false,
  activityStates = {}
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
  
  // Communication icons logic (same as SimpleAgentCard)
  const { currentSite } = useSite()
  
  // Determine if this agent should have entry icons (Customer Support)
  const shouldShowEntryIcons = agent.id === "7" && hasCustomData && displayStatus === "active"
  
  // Determine which agents should show exit (reach out) icons
  const shouldShowExitIcons = (
    (agent.id === "5" || agent.id === "7" || agent.id === "1") && 
    hasCustomData && 
    displayStatus === "active"
  )
  
  const enabledChannels = getEnabledSiteChannels(currentSite)
  
  // Format date consistently
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(displayLastActive));

  return (
    <React.Fragment>
      <DocumentListRow
        onClick={() => {
          onToggleExpand(agent);
          if (setSelectedAgent) {
            setSelectedAgent(agent);
          }
        }}
        className={cn(
          "group",
          isExpanded && "bg-muted/20"
        )}
      >
        <TableCell className="py-3.5 pl-4 sm:pl-6">
          <EntityCell
            name={displayName}
            secondary={shouldShowRole ? displayRole : null}
            meta={displayDescription}
            secondaryMono={false}
          />
        </TableCell>
        
        <TableCell className="py-3.5">
          <span className="text-xs font-medium text-muted-foreground">{displayType.charAt(0).toUpperCase() + displayType.slice(1)}</span>
        </TableCell>
        
        <TableCell className="py-3.5">
          <StatusDot status={displayStatus} label={displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)} />
        </TableCell>

        <TableCell className="py-3.5">
          <div className="flex flex-col gap-2">
            {shouldShowEntryIcons && (
              <div className="flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5 text-emerald-600/70" />
                <div className="flex flex-wrap gap-1">
                  {enabledChannels.map((channel) => (
                    <ChannelBadge key={channel} channel={channel} size="sm" titleSuffix="Support" />
                  ))}
                </div>
              </div>
            )}
            
            {hasCustomData && displayStatus === "active" && (
              <div className="flex items-center gap-1.5">
                {shouldShowExitIcons && (
                  <LogOut className="h-3.5 w-3.5 text-amber-600/70" />
                )}
                <div className="flex flex-wrap gap-1">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full font-inter bg-amber-100 dark:bg-amber-900/40" title="System Notifications">
                    <Bell className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  {shouldShowExitIcons && enabledChannels.map((channel) => (
                    <ChannelBadge key={channel} channel={channel} size="sm" titleSuffix="Outreach" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="py-3.5 text-right">
          <span className="text-[13px] text-muted-foreground tabular-nums">{formattedDate}</span>
        </TableCell>

        <TableCell className="py-3.5 pr-4 sm:pr-6">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground" 
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
              className={cn("h-8 w-8", isExpanded ? "opacity-100 text-foreground" : "text-muted-foreground hover:text-foreground")}
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </TableCell>
      </DocumentListRow>
      
      {/* Activities Section - Expanded */}
      {isExpanded && agent.activities && agent.activities.length > 0 && (
        <>
          {agent.activities.map((activity: AgentActivity) => (
            <AgentActivityItem 
              key={activity.id} 
              activity={activity} 
              onExecute={(activity) => onExecuteActivity(agent, activity)}
              viewMode="table"
              executionStatus={activityStates[activity.id]}
            />
          ))}
        </>
      )}
    </React.Fragment>
  )
} 