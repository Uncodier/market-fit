import { Button } from "@/app/components/ui/button"

interface AgentIntegrationProps {
  id: string
  name: string
  description: string
  connected: boolean
  onToggle: (id: string, connected: boolean) => void
}

export function AgentIntegration({ id, name, description, connected, onToggle }: AgentIntegrationProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <div className="font-medium">{name}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Button 
        variant={connected ? "outline" : "default"} 
        size="sm"
        onClick={() => onToggle(id, !connected)}
      >
        {connected ? "Disconnect" : "Connect"}
      </Button>
    </div>
  )
} 