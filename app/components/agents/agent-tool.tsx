import { Switch } from "@/app/components/ui/switch"

interface AgentToolProps {
  id: string
  name: string
  description: string
  enabled: boolean
  onToggle: (id: string, enabled: boolean) => void
}

export function AgentTool({ id, name, description, enabled, onToggle }: AgentToolProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="space-y-1">
        <div className="font-medium">{name}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch 
        checked={enabled} 
        onCheckedChange={(checked) => onToggle(id, checked)}
        aria-label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
      />
    </div>
  )
} 