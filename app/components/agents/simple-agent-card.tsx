import { cn } from "@/lib/utils"
import { Agent, AgentActivity } from "@/app/types/agents"
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Pencil, MessageSquare, ChevronUp, ChevronDown, Mail, Globe, Send, LogIn, LogOut, Bell } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { agentStatusVariants, agentCardVariants } from "./agent-card.styles"
import { AgentActivityList } from "./agent-activity-list"
import { useSite } from "@/app/context/SiteContext"
import { ActivityExecutionStatus } from "@/app/hooks/use-activity-execution"

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

interface SimpleAgentCardProps {
  agent: ExtendedAgent
  onManage?: (agent: ExtendedAgent) => void
  onChat?: (agent: ExtendedAgent) => void
  onToggleActivities?: (agent: ExtendedAgent) => void
  showActivities?: boolean
  onExecuteActivity?: (agent: ExtendedAgent, activity: AgentActivity) => void
  className?: string
  selectedAgent?: ExtendedAgent | null
  setSelectedAgent?: (agent: ExtendedAgent | null) => void
  forceShow?: boolean
  activityStates?: Record<string, ActivityExecutionStatus>
}

export function SimpleAgentCard({ 
  agent, 
  onManage, 
  onChat,
  onToggleActivities,
  showActivities = false,
  onExecuteActivity,
  className,
  selectedAgent,
  setSelectedAgent,
  forceShow = false,
  activityStates = {}
}: SimpleAgentCardProps) {
  // Si el agente está marcado como deshabilitado y no estamos forzando a mostrarlo, no renderizarlo
  if (agent.isDisabled && !forceShow) {
    console.log(`SimpleAgentCard: Ocultando agente ${agent.name} (${agent.id}) porque isDisabled=true`);
    return null;
  }

  // Function to get the icon component based on the name
  const getIconComponent = (iconName: string) => {
    // @ts-ignore - Icons is an object that contains all the icons
    return Icons[iconName] || Icons.User;
  };
  
  // Get the icon component
  const IconComponent = getIconComponent(agent.icon);

  const handleCardClick = () => {
    if (setSelectedAgent) {
      setSelectedAgent(agent);
    }
  };
  
  // Determinar qué datos mostrar (DB o template)
  const hasCustomData = !!agent.dbData;
  
  // Determinar nombre y descripción a mostrar
  const displayName = hasCustomData ? agent.dbData!.name : agent.name;
  const displayDescription = hasCustomData ? agent.dbData!.description : agent.description;
  const displayStatus = hasCustomData ? agent.dbData!.status : "inactive";
  const displayRole = hasCustomData ? agent.dbData!.role : (agent.role || agent.name);
  
  // Determinar si mostrar el rol separadamente (si el nombre es diferente al rol)
  const shouldShowRole = hasCustomData && displayName !== displayRole;

  // Determinar si el botón de chat debe estar deshabilitado
  const isChatDisabled = !hasCustomData;
  
  // Determine if this agent should have entry icons (Customer Support)
  const shouldShowEntryIcons = agent.id === "7" && hasCustomData && displayStatus === "active"
  
  // Determine which agents should show exit (reach out) icons
  const shouldShowExitIcons = (
    (agent.id === "5" || agent.id === "7" || agent.id === "1") && 
    hasCustomData && 
    displayStatus === "active"
  )

  const { currentSite } = useSite()
  
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

  return (
    <div className={cn(
      "flex flex-col relative",
      className
    )}>
      <Card 
        className={cn(
          "h-auto flex flex-col",
          agentCardVariants({ hover: true }),
          hasCustomData && "border-primary/30" // Highlight personalized agents
        )}
        onClick={handleCardClick}
      >
        <CardHeader className="pb-4 flex-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3 min-w-0">
              <Avatar className="h-10 w-10 ring-2 ring-background flex-none">
                <AvatarImage 
                  src={`/avatars/agent-${agent.id}.png`} 
                  alt={`${displayName}'s avatar`} 
                />
                <AvatarFallback className="bg-primary/10">
                  <IconComponent className="h-5 w-5" aria-hidden={true} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <CardTitle className="text-lg font-semibold leading-none truncate">
                    {displayName}
                  </CardTitle>
                  {shouldShowRole && (
                    <div className="text-xs font-medium text-primary/70 truncate ml-1">
                      ({displayRole})
                    </div>
                  )}
                </div>
                <CardDescription 
                  className="truncate text-sm"
                  title={displayDescription}
                >
                  {displayDescription}
                </CardDescription>
              </div>
            </div>
            <Badge 
              className={cn(
                "flex-none mt-1",
                agentStatusVariants({ status: displayStatus as any })
              )}
              aria-label={`Agent status: ${displayStatus}`}
            >
              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        
        {/* Activities section inside the card */}
        {showActivities && agent.activities && agent.activities.length > 0 && (
          <div className="border-t border-border">
            <AgentActivityList
              agent={agent}
              onExecute={onExecuteActivity || (() => {})}
              hideTitle={false}
              activityStates={activityStates}
            />
          </div>
        )}
        
        <CardFooter className={cn(
          "flex gap-2 flex-none",
          showActivities ? "pt-4 pb-4" : "pt-2 pb-4"
        )}>
          <Button 
            variant="outline" 
            className="flex-1 h-9"
            onClick={(e) => {
              e.stopPropagation();
              onManage?.(agent);
            }}
            aria-label={`Manage ${displayName}`}
          >
            <Pencil className="h-4 w-4 mr-2" aria-hidden={true} />
            Manage Agent
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 h-9"
            onClick={(e) => {
              e.stopPropagation();
              onChat?.(agent);
            }}
            aria-label={`Chat with ${displayName}`}
            disabled={isChatDisabled}
          >
            <MessageSquare className="h-4 w-4 mr-2" aria-hidden={true} />
            Chat
          </Button>
        </CardFooter>
        
        {/* Toggle Activities Button */}
        {onToggleActivities && (
          <div className="border-t pt-1 pb-1 flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full flex items-center justify-center gap-1.5 h-7 rounded-none hover:bg-accent/70 transition-colors text-xs font-medium text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onToggleActivities(agent);
              }}
            >
              {showActivities ? (
                <>
                  Hide Activities
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show Activities ({agent.activities?.length || 0})
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
      
      {/* Entry Icons - positioned closer to the left of the card */}
      {shouldShowEntryIcons && (
        <div className="absolute -left-12 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-2">
          <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
          <div className="flex flex-col items-center gap-2">
            {enabledChannels.map((channel) => (
              <div key={channel} className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shadow-sm ${
                channel === 'whatsapp' 
                  ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60' 
                  : channel === 'email'
                  ? 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60'
                  : 'bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60'
              }`} title={`${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Web Chat'} Support`}>
                {channel === 'whatsapp' && <WhatsAppIcon size={16} className="text-green-600 dark:text-green-400" />}
                {channel === 'email' && <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                {channel === 'web' && <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Communication Icons - single column for agents with custom data and active status */}
      {hasCustomData && displayStatus === "active" && (
        <div className="absolute -right-12 top-1/2 transform -translate-y-1/2 flex flex-col items-center gap-2">
          {shouldShowExitIcons && (
            <LogOut className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          )}
          <div className="flex flex-col items-center gap-2">
            {/* System Notifications - always shown for agents with custom data and active status */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors cursor-pointer shadow-sm" title="System Notifications">
              <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            
            {/* Communication Channels - only for agents with reach out capability and enabled channels */}
            {shouldShowExitIcons && enabledChannels.map((channel) => (
              <div key={channel} className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shadow-sm ${
                channel === 'whatsapp' 
                  ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-800/60' 
                  : channel === 'email'
                  ? 'bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60'
                  : 'bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60'
              }`} title={`${channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Web Chat'} Outreach`}>
                {channel === 'whatsapp' && <WhatsAppIcon size={16} className="text-green-600 dark:text-green-400" />}
                {channel === 'email' && <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                {channel === 'web' && <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 