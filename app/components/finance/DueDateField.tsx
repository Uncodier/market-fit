"use client"

import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

export function DueDateField({ id, value, onChange, disabled, description }: {
  id: string
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  description?: string
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Due date (optional)</Label>
      <Input id={id} type="date" className="h-12" value={value || ""} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  )
}