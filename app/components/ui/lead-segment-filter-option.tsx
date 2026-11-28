import { Users } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"

interface LeadSegmentFilterOptionProps {
  segment: { id: string; name: string }
  checked: boolean
  onToggle: (id: string) => void
}

export function LeadSegmentFilterOption({ segment, checked, onToggle }: LeadSegmentFilterOptionProps) {
  const id = `segment-${segment.id}`

  return (
    <div className="flex min-w-0 items-center space-x-2">
      <Switch id={id} checked={checked} onCheckedChange={() => onToggle(segment.id)} />
      <Label htmlFor={id} className="flex min-w-0 items-center gap-1.5 cursor-pointer">
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate" title={segment.name}>{segment.name}</span>
      </Label>
    </div>
  )
}