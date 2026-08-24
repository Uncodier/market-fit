"use client"

import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { WF_FIELD_CLASS } from "./types"

function withCurrentOption(
  options: readonly { value: string; label: string }[],
  current?: string,
) {
  if (!current || options.some((option) => option.value === current)) return options
  return [...options, { value: current, label: current }]
}

export function WorkflowSearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  allowCreate = true,
  clearable = false,
  disabled,
}: {
  options: readonly { value: string; label: string }[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  clearable?: boolean
  disabled?: boolean
}) {
  const list = withCurrentOption(options, value)
  const selected = list.find((option) => option.value === value)
  const relationValue: RelationSelectValue = value
    ? { mode: "existing", id: value, label: selected?.label || value }
    : null

  return (
    <div className="min-w-0 w-full" onPointerDown={(event) => event.stopPropagation()}>
      <RelationSelect
        options={list.map((option) => ({ id: option.value, label: option.label }))}
        value={relationValue}
        onValueChange={(next) => {
          if (!next) {
            onChange("")
            return
          }
          onChange(next.mode === "create" ? next.label : next.id)
        }}
        allowCreate={allowCreate}
        clearable={clearable}
        disabled={disabled}
        placeholder={placeholder}
        searchPlaceholder="Search..."
        createLabel={(query) => `Use "${query}"`}
        emptyMessage="No results found"
        className={WF_FIELD_CLASS}
      />
    </div>
  )
}
