"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toolActions, type ToolAction } from "./tool-action-types"

export function ToolActionSelect({ value, onChange }: { value: ToolAction; onChange: (action: ToolAction) => void }) {
  const { t } = useLocalization()
  return <Select value={value} onValueChange={action => {
    const selected = toolActions.find(option => option === action)
    if (selected) onChange(selected)
  }}>
    <SelectTrigger aria-label={t("connectors.toolAction.label")}><SelectValue /></SelectTrigger>
    <SelectContent>{toolActions.map(action => <SelectItem key={action} value={action}>
      {t(`connectors.toolAction.${action}`)}
    </SelectItem>)}</SelectContent>
  </Select>
}