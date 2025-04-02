import { Card } from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { HelpCircle } from "@/app/components/ui/icons"

interface AgentTriggerProps {
  id: string
  name: string
  description: string
  enabled: boolean
  onToggle: (id: string, enabled: boolean) => void
}

export function AgentTrigger({ id, name, description, enabled, onToggle }: AgentTriggerProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium leading-none">{name}</Label>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onToggle(id, checked)}
        />
      </div>
    </Card>
  )
} 