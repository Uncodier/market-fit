import { AgentCard } from "@/app/components/agents/agent-card"
import { Agent, AgentType } from "@/app/types/agents"
import { cn } from "@/lib/utils"

interface AgentListProps {
  agents: Agent[]
  type?: AgentType
  onManageAgent?: (agent: Agent) => void
  onChatWithAgent?: (agent: Agent) => void
  className?: string
}

export function AgentList({ 
  agents, 
  type, 
  onManageAgent, 
  onChatWithAgent,
  className
}: AgentListProps) {
  const filteredAgents = type 
    ? agents.filter(agent => agent.type === type)
    : agents

  if (filteredAgents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <p className="text-lg font-medium text-muted-foreground mb-2">
          No agents found
        </p>
        <p className="text-sm text-muted-foreground">
          {type 
            ? `No ${type} agents available at the moment`
            : "No agents match your search criteria"}
        </p>
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
        "animate-in fade-in-50 duration-300",
        className
      )}
      role="list"
      aria-label={type ? `${type} agents` : "All agents"}
    >
      {filteredAgents.map((agent) => (
        <div key={agent.id} role="listitem">
          <AgentCard
            agent={agent}
            onManage={onManageAgent}
            onChat={onChatWithAgent}
          />
        </div>
      ))}
    </div>
  )
} 