import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { 
  MessageSquare, 
  Pencil, 
  User as UserIcon,
  ShoppingCart,
  HelpCircle,
  BarChart,
  Tag,
  Settings,
  Users,
  Check,
  PieChart
} from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { Agent } from "@/app/types/agents"
import { agentStatusVariants, agentCardVariants, metricItemVariants } from "./agent-card.styles"
import { cn } from "@/lib/utils"

interface AgentCardProps {
  agent: Agent
  onManage?: (agent: Agent) => void
  onChat?: (agent: Agent) => void
  className?: string
}

export function AgentCard({ 
  agent, 
  onManage, 
  onChat,
  className 
}: AgentCardProps) {
  // Añadir console.log para depuración
  console.log("Rendering AgentCard for agent:", agent.name, "icon:", agent.icon)
  
  // Función para obtener el componente de icono basado en el nombre
  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'ShoppingCart':
        return ShoppingCart;
      case 'HelpCircle':
        return HelpCircle;
      case 'BarChart':
        return BarChart;
      case 'Tag':
        return Tag;
      case 'Settings':
        return Settings;
      case 'Users':
        return Users;
      case 'Check':
        return Check;
      case 'User':
        return UserIcon;
      case 'PieChart':
        return PieChart;
      default:
        return UserIcon; // Icono por defecto
    }
  };
  
  // Obtener el componente de icono
  const IconComponent = getIconComponent(agent.icon);
  
  // Verificar si el icono existe
  console.log("Using icon component for:", agent.icon)

  const renderMetricItem = (label: string, value: string | number) => (
    <div className={cn(
      "p-3 h-[72px] flex flex-col justify-between",
      metricItemVariants({ hover: true })
    )}>
      <p className="text-sm font-medium leading-none text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold mt-2">
        {value}
      </p>
    </div>
  )

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(agent.lastActive))

  return (
    <Card 
      className={cn(
        "h-[340px] flex flex-col",
        agentCardVariants({ hover: true }),
        className
      )}
    >
      <CardHeader className="pb-4 flex-none">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3 min-w-0">
            <Avatar className="h-10 w-10 ring-2 ring-background flex-none">
              <AvatarImage 
                src={`/avatars/agent-${agent.id}.png`} 
                alt={`${agent.name}'s avatar`} 
              />
              <AvatarFallback className="bg-primary/10">
                {IconComponent ? (
                  <IconComponent className="h-5 w-5" aria-hidden={true} />
                ) : (
                  agent.name.split(" ").map(name => name[0]).join("")
                )}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold leading-none mb-1.5 truncate">
                {agent.name}
              </CardTitle>
              <CardDescription 
                className="truncate text-sm"
                title={agent.description}
              >
                {agent.description}
              </CardDescription>
            </div>
          </div>
          <Badge 
            className={cn(
              "flex-none mt-1",
              agentStatusVariants({ status: agent.status })
            )}
            aria-label={`Agent status: ${agent.status}`}
          >
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 py-2">
        <div className="grid grid-cols-2 gap-2 h-full">
          {renderMetricItem("Type", agent.type.charAt(0).toUpperCase() + agent.type.slice(1))}
          {renderMetricItem("Conversations", new Intl.NumberFormat().format(agent.conversations))}
          {renderMetricItem("Success Rate", `${agent.successRate}%`)}
          {renderMetricItem("Last Active", formattedDate)}
        </div>
      </CardContent>
      <CardFooter className="pt-4 pb-4 flex gap-2 flex-none">
        <Button 
          variant="outline" 
          className="flex-1 h-9"
          onClick={() => onManage?.(agent)}
          aria-label={`Manage ${agent.name}`}
        >
          <Pencil className="h-4 w-4 mr-2" aria-hidden={true} />
          Manage Agent
        </Button>
        <Button 
          variant="outline" 
          className="flex-1 h-9"
          onClick={() => onChat?.(agent)}
          aria-label={`Chat with ${agent.name}`}
        >
          <MessageSquare className="h-4 w-4 mr-2" aria-hidden={true} />
          Chat
        </Button>
      </CardFooter>
    </Card>
  )
} 