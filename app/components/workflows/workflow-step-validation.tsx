"use client"

import { Button } from "@/app/components/ui/button"
import { Switch } from "@/app/components/ui/switch"
import { Plus, X } from "@/app/components/ui/icons"
import { WF_FIELD_CLASS, normalizeValidationRules, type WorkflowValidationRule } from "./types"

export function WorkflowStepValidationList({
  rules,
  onChange,
}: {
  nodeId: string
  rules: unknown
  onChange: (rules: WorkflowValidationRule[]) => void
}) {
  const items = normalizeValidationRules(rules)

  const addRule = () => {
    onChange([...items, { rule: "", required: true }])
  }

  const updateAt = (index: number, patch: Partial<WorkflowValidationRule>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Rules</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={addRule}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">None (agent infers)</p>
      ) : (
        items.map((item, index) => (
          <div
            key={`${item.rule}-${index}`}
            className="flex flex-col gap-1.5 p-2 bg-background/70 border border-border/60 rounded-xl"
          >
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 ${WF_FIELD_CLASS}`}
                defaultValue={item.rule}
                placeholder="Rule (e.g. preview_url or npm run build returns 0)"
                onBlur={(event) => updateAt(index, { rule: event.target.value.trim() })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                className={`flex-1 ${WF_FIELD_CLASS}`}
                defaultValue={item.value || ""}
                placeholder="Value (optional)"
                onBlur={(event) => {
                  const value = event.target.value.trim()
                  updateAt(index, { value: value || undefined })
                }}
              />
              <label className="flex items-center gap-2 shrink-0 px-1">
                <span className="text-[11px] font-medium">Required</span>
                <Switch
                  checked={item.required !== false}
                  onCheckedChange={(checked) => updateAt(index, { required: checked })}
                />
              </label>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
