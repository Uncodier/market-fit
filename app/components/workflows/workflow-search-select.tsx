"use client"

import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { WF_FIELD_CLASS } from "./types"

type WorkflowSelectOption = { value: string; label: string; group?: string; description?: string; searchText?: string }

function withCurrentOption(
  options: readonly WorkflowSelectOption[],
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
  includeCurrentOption = true,
  label,
}: {
  options: readonly WorkflowSelectOption[]
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  clearable?: boolean
  disabled?: boolean
  /** Keep unavailable values visible without offering them as selectable options. */
  includeCurrentOption?: boolean
  label?: string
}) {
  const list = includeCurrentOption ? withCurrentOption(options, value) : options
  const selected = list.find((option) => option.value === value)
  const relationValue: RelationSelectValue = value
    ? { mode: "existing", id: value, label: selected?.label || value }
    : null

  return (
    <div className="min-w-0 w-full" onPointerDown={(event) => event.stopPropagation()}>
      <RelationSelect
        options={list.map(({ value: id, ...option }) => ({ id, ...option }))}
        label={label}
        value={relationValue}
        onValueChange={(next) => {
          if (!next) {
            onChange("")
            return
          }
          if (!includeCurrentOption && (next.mode !== "existing" || !options.some((option) => option.value === next.id))) return
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
