"use client"

import { createPortal } from "react-dom"
import { SearchInput } from "@/app/components/ui/search-input"

export function SkillsSearch({ target, label, value, onChange, onSubmit, disabled, maxLength = 200 }: {
  target: HTMLElement | null
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  disabled: boolean
  maxLength?: number
}) {
  if (!target) return null

  return createPortal(
    <form role="search" aria-label={label} className="min-w-0" onSubmit={event => {
      event.preventDefault()
      const query = value.trim()
      if (!disabled && query) onSubmit?.(query)
    }}>
      <SearchInput aria-label={label} placeholder={label} value={value} onSearch={onChange} enterKeyHint="search"
        disabled={disabled} maxLength={maxLength} />
    </form>, target,
  )
}