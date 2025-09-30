import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { MessageSquare, Pencil, PlayCircle, ChevronUp, ChevronDown, Mail, Globe, Bell, LogIn, LogOut } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { agentStatusVariants, metricItemVariants } from "./agent-card.styles"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useSite } from "@/app/context/SiteContext"
import { ActivityExecutionStatus } from "@/app/hooks/use-activity-execution"
import { AgentActivityItem } from "./agent-activity-item"

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
  
  // Check which channels are enabled in site settings
  const channels = currentSite?.settings?.channels
  const isEmailEnabled = channels?.email?.enabled && channels?.email?.status === "synced"
  const isWhatsAppEnabled = channels?.whatsapp?.enabled && channels?.whatsapp?.status === "active"
  const isWebChatEnabled = currentSite?.tracking?.enable_chat // Chat is in site.tracking, not settings

  // Get enabled communication channels
  const enabledChannels = []
  if (isWhatsAppEnabled) enabledChannels.push('whatsapp')
  if (isEmailEnabled) enabledChannels.push('email')
  if (isWebChatEnabled) enabledChannels.push('web')
  
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
            <AvatarFallback className="bg-primary/5">
              {displayName.length >= 2 
                ? displayName.substring(0, 2).toUpperCase()
                : displayName.split(" ").map(name => name[0]).join("").substring(0, 2)}
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
        
        {/* Entry Icons Column */}
        <div className="w-20 flex justify-center">
          {shouldShowEntryIcons && (
            <div className="flex items-center gap-1">
              <LogIn className="h-3 w-3 text-green-600 dark:text-green-400" />
              <div className="flex gap-1">
                {enabledChannels.map((channel) => (
                  <div key={channel} className={`flex items-center justify-center w-5 h-5 rounded-full ${
                    channel === 'whatsapp' 
                      ? 'bg-green-100 dark:bg-green-900/40' 
                      : channel === 'email'
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-purple-100 dark:bg-purple-900/40'
                  }`} title={`${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Web Chat'} Support`}>
                    {channel === 'whatsapp' && <WhatsAppIcon size={10} className="text-green-600 dark:text-green-400" />}
                    {channel === 'email' && <Mail className="h-2 w-2 text-blue-600 dark:text-blue-400" />}
                    {channel === 'web' && <Globe className="h-2 w-2 text-purple-600 dark:text-purple-400" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Communication Icons Column */}
        <div className="w-24 flex justify-center">
          {hasCustomData && displayStatus === "active" && (
            <div className="flex items-center gap-1">
              {shouldShowExitIcons && (
                <LogOut className="h-3 w-3 text-orange-600 dark:text-orange-400" />
              )}
              <div className="flex gap-1">
                {/* System Notifications - always shown for agents with custom data and active status */}
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40" title="System Notifications">
                  <Bell className="h-2 w-2 text-amber-600 dark:text-amber-400" />
                </div>
                
                {/* Communication Channels - only for agents with reach out capability and enabled channels */}
                {shouldShowExitIcons && enabledChannels.map((channel) => (
                  <div key={channel} className={`flex items-center justify-center w-5 h-5 rounded-full ${
                    channel === 'whatsapp' 
                      ? 'bg-green-100 dark:bg-green-900/40' 
                      : channel === 'email'
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-purple-100 dark:bg-purple-900/40'
                  }`} title={`${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Web Chat'} Outreach`}>
                    {channel === 'whatsapp' && <WhatsAppIcon size={10} className="text-green-600 dark:text-green-400" />}
                    {channel === 'email' && <Mail className="h-2 w-2 text-blue-600 dark:text-blue-400" />}
                    {channel === 'web' && <Globe className="h-2 w-2 text-purple-600 dark:text-purple-400" />}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                <AgentActivityItem 
                  key={activity.id} 
                  activity={activity} 
                  onExecute={(activity) => onExecuteActivity(agent, activity)}
                  viewMode="vertical"
                  executionStatus={activityStates[activity.id]}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 